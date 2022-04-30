import * as z from "zod";
import cuid from "cuid";
import prisma from "../../../lib/prisma";
import * as log from "../../../lib/logging";

import { createExecution, formatExecution } from "../../../lib/execution";
import {
  getSearchConfiguration,
  formatSearchConfiguration,
  createSearchConfiguration,
  WeightedJudgement,
  loadSearchConfigurations,
  createSCOperation,
} from "../../../lib/searchconfigurations";
import {
  updateQueryTemplate,
  getLatestQueryTemplates,
  getQueryTemplate,
} from "../../../lib/querytemplates";
import {
  createJudgementPhrases,
  getJudgementPhrase,
  getLatestJudgements,
  updateJudgement,
} from "../../../lib/judgements";
import {
  apiHandler,
  requireMethod,
  requireUser,
  requireBody,
  requireQuery,
} from "../../../lib/apiServer";
import { getRuleset, getLatestRulesetVersion } from "../../../lib/rulesets";
import { RulesetVersion } from "../../../lib/prisma";
import { addTask, removeTask } from "../../../lib/runningTasks";
import { getProject, updateProject } from "../../../lib/projects";
import { getJudgementForSearchConfiguration } from "../../../lib/judgements";
import { getSearchEndpoint } from "../../../lib/searchendpoints";
import { ErrorMessage } from "../../../lib/errors/constants";
import { notFound } from "../../../lib/errors";

export const handleGetSearchConfigurationById = apiHandler(async (req, res) => {
  requireMethod(req, "GET");
  const user = requireUser(req);
  const { id } = requireQuery(req, z.object({ id: z.string() }));

  const sc = await getSearchConfiguration(user, id);
  if (!sc || !sc.queryTemplate) {
    return notFound(res, ErrorMessage.SearchConfigurationNotFound);
  }

  const project = await getProject(user, sc.queryTemplate.projectId);

  if (!project) {
    return notFound(res, ErrorMessage.ProjectNotFound);
  }

  const searchEndPoint = await getSearchEndpoint(
    user,
    project.searchEndpointId
  );

  if (!searchEndPoint) {
    return notFound(res, ErrorMessage.SearchEndpointNotFound);
  }

  return res
    .status(200)
    .json(formatSearchConfiguration(sc, searchEndPoint.type));
});

export const handleCreateSearchConfiguration = apiHandler(async (req, res) => {
  requireMethod(req, "POST");
  const user = requireUser(req);
  const input = requireBody(
    req,
    z.object({
      projectId: z.string(),
      queryTemplateQuery: z.string(),
      knobs: z.any(),
      judgementName: z.string(),
      searchPhrases: z.array(z.string()),
    })
  );

  const project = await getProject(user, input.projectId);

  if (!project) {
    return notFound(res, ErrorMessage.ProjectNotFound);
  }

  const initialQueryTemplate = (
    await getLatestQueryTemplates(user, project, 1)
  )[0];

  let queryTemplate = { ...initialQueryTemplate };

  if (
    initialQueryTemplate.query !== input.queryTemplateQuery ||
    Object.entries(input.knobs).length
  ) {
    queryTemplate = await updateQueryTemplate(initialQueryTemplate, {
      query: input.queryTemplateQuery,
      description: "Update number 1",
    });
  }

  let judgement = (await getLatestJudgements(user, project, 1))[0];

  if (judgement.name !== input.judgementName) {
    judgement = await updateJudgement(judgement, { name: input.judgementName });
  }

  const searchConfigurationId = cuid();

  const createJPOperations = createJudgementPhrases(
    judgement,
    input.searchPhrases.filter(async (phrase) => {
      const judgementPhrase = await getJudgementPhrase(judgement, phrase);
      return !judgementPhrase;
    })
  );

  const createSCOp = createSCOperation({
    id: searchConfigurationId,
    queryTemplateId: queryTemplate.id,
    projectId: project.id,
    rulesets: [],
    knobs: input.knobs,
    judgements: [[judgement, 1]],
  });

  const updateProjectOperation = updateProject(user, project, null, {
    activeSearchConfigurationId: searchConfigurationId,
  });

  await prisma.$transaction([
    ...createJPOperations,
    createSCOp,
    updateProjectOperation,
  ]);

  const searchConfiguration = await getSearchConfiguration(
    user,
    searchConfigurationId
  );

  return res.status(200).json(searchConfiguration);
});

export const handleUpdateSearchConfiguration = apiHandler(async (req, res) => {
  requireMethod(req, "POST");
  const user = requireUser(req);
  const input = requireBody(
    req,
    z.object({
      id: z.string(),
      queryTemplateId: z.string(),
      knobs: z.any(),
      rulesetIds: z.array(z.string()).optional(),
    })
  );

  const currentSearchConfiguration = await getSearchConfiguration(
    user,
    input.id
  );
  if (!currentSearchConfiguration) {
    return notFound(res, ErrorMessage.SearchConfigurationNotFound);
  }

  const queryTemplate = await getQueryTemplate(user, input.queryTemplateId);
  if (!queryTemplate) {
    return notFound(res, ErrorMessage.QueryTemplateNotFound);
  }

  // Populate rulesets
  let rulesets: RulesetVersion[] = [];
  if (input.rulesetIds) {
    try {
      const rulesetVersions = await Promise.all(
        input.rulesetIds.map((id) => getRuleset(user, id))
      );
      if (rulesetVersions.includes(null)) {
        return notFound(res, ErrorMessage.RulesetsNotFound);
      }
      rulesets = await Promise.all(
        rulesetVersions.map(async (rs) => (await getLatestRulesetVersion(rs!))!)
      );
    } catch (err) {
      return notFound(res, ErrorMessage.RulesetNotFound);
    }
  }

  // Current search configuration judgements
  const searchConfigurationJudgements = await getJudgementForSearchConfiguration(
    currentSearchConfiguration
  );
  const judgements = searchConfigurationJudgements
    ? [
        [
          searchConfigurationJudgements.judgement,
          searchConfigurationJudgements.weight,
        ],
      ]
    : [];

  const currentProject = await getProject(user, queryTemplate.projectId);
  if (!currentProject) {
    return notFound(res, ErrorMessage.ProjectNotFound);
  }

  const searchEndpoint = await getSearchEndpoint(
    user,
    currentProject.searchEndpointId
  );
  if (!searchEndpoint) {
    return notFound(res, ErrorMessage.SearchEndpointNotFound);
  }

  // Create new search configuration with created query template and rulesets
  const createdSearchConfiguration = await createSearchConfiguration({
    queryTemplateId: queryTemplate.id,
    projectId: queryTemplate.projectId,
    rulesets,
    knobs: input.knobs,
    parentId: currentSearchConfiguration.id,
    judgements: judgements as WeightedJudgement[],
  });

  return res.status(200).json({
    searchConfiguration: formatSearchConfiguration(
      createdSearchConfiguration,
      searchEndpoint.type
    ),
  });
});

export const handleExecuteSearchConfiguration = apiHandler(async (req, res) => {
  requireMethod(req, "POST");
  const user = requireUser(req);
  const input = requireBody(req, z.object({ id: z.string() }));

  const taskName = `Search Configuration Execution - ${
    input.id
  } - ${Date.now()}`;
  const socketIO = req.io;

  // Add task to running tasks list
  const tasks = await addTask(taskName);
  if (socketIO) {
    socketIO.emit("running_tasks", { tasks });
  }

  try {
    const currentSearchConfiguration = await getSearchConfiguration(
      user,
      input.id
    );
    if (!currentSearchConfiguration?.queryTemplate?.projectId) {
      return notFound(res, ErrorMessage.SearchConfigurationNotFound);
    }

    const execution = await createExecution(
      currentSearchConfiguration,
      currentSearchConfiguration.queryTemplate.projectId
    );

    // Remove task from running tasks list
    await removeTask(taskName);

    res.status(200).json({ execution: formatExecution(execution) });
  } catch (error: any) {
    // Remove task from running tasks list
    const tasks = await removeTask(taskName);
    if (socketIO) {
      socketIO.emit("running_tasks", { tasks });
    }

    log.error(error.stack ?? error, req, res);

    let message;
    switch (error.errno) {
      case "ECONNREFUSED":
        message =
          "Request to Search Endpoint failed, reason: connect ECONNREFUSED. Please check your cluster, or go to Search Endpoint and fix the connection details.";
        break;
      default:
        message = error.message;
    }

    res.status(500).json({ error: message ?? "Internal server error" });
  }
});

export default apiHandler(async (req, res) => {
  requireMethod(req, "POST");
  const user = requireUser(req);
  const { projectId } = requireBody(req, z.object({ projectId: z.string() }));

  const project = await getProject(user, projectId);
  if (!project) {
    return notFound(res, ErrorMessage.ProjectNotFound);
  }

  const searchConfigurations = await loadSearchConfigurations(project.id);

  return res.status(200).json({ searchConfigurations });
});
