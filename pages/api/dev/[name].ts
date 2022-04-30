import { NextApiRequest, NextApiResponse } from "next";
import * as fs from "fs";
import * as path from "path";

import { RulesetVersionValue } from "../../../lib/rulesets/rules";
import prisma from "../../../lib/prisma";
import { setVotes, parseVotesCsv } from "../../../lib/judgements";
import { createExecution } from "../../../lib/execution";
import { notAuthorized, notFound } from "../../../lib/errors";
import { getUser, ValidUserSession } from "../../../lib/authServer";
import { userCanAccessOrg } from "../../../lib/org";
import { createSearchEndpoint } from "../../../lib/searchendpoints";
import { createRuleset, createRulesetVersion } from "../../../lib/rulesets";
import {
  createQueryTemplate,
  updateQueryTemplate,
} from "../../../lib/querytemplates";
import * as log from "../../../lib/logging";

// prettier-ignore
const mockRuleset: RulesetVersionValue = {
  conditions: [],
  rules: [
    {
      expression: "notebook",
      expressionType: 'contained',
      isCaseSensitive: false,
      instructions: [
        { type: "synonym", directed: false, weight: 1, term: "laptop", enabled: true },
        { type: "synonym", directed: true, weight: 1, term: "netbook", enabled: true },
        { type: "upboost", weight: 2, term: "asus", enabled: true },
        { type: "downboost", weight: -3, term: "keyboard", enabled: false },
        { type: "downboost", weight: -4, term: "mouse", enabled: true },
        { type: "downboost", weight: -4, term: "Optical", enabled: true },
        { type: "downboost", weight: -1, term: "Power Cord", enabled: true },
        { type: "downboost", weight: -3, term: "spare part", enabled: true },
        { type: "filter", include: false, term: "title:accessory", enabled: true },
        { type: "filter", include: false, term: "title:notebook", enabled: true },
      ],
      enabled: true,
    },
    {
      expression: "cheap iphone",
      expressionType: 'contained',
      isCaseSensitive: false,
      instructions: [
        { type: "delete", term: "cheap", enabled: true },
      ],
      enabled: true,
    },
  ],
};

const mockQuery = JSON.stringify({
  query: {
    match: {
      title: "#$query#",
    },
  },
});

const seedJudgementFile = path.join(
  process.cwd(),
  "fixtures/Broad_Query_Set_rated.csv"
);

async function handleSolrSeed(
  { user }: ValidUserSession,
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  const org = await prisma.org.findFirst({
    where: userCanAccessOrg(user, {
      id: user.defaultOrgId!,
    }),
  });
  if (!org) {
    return res.status(500).json({ error: "user has no attached org" });
  }

  const searchEndpoint = await createSearchEndpoint(user, {
    orgId: org.id,
    name: "Local Solr",
    description: "Solr instance on localhost.",
    resultId: "_id",
    displayFields: ["title:title", "short_description", "image:img_thumb"],
    type: "SOLR",
    info: {
      endpoint: "http://localhost:8983",
      index: "gettingstarted",
    },
    credentials: null,
  });

  const project = await prisma.project.create({
    data: {
      orgId: org.id,
      searchEndpointId: searchEndpoint.id,
      name: "Dev Solr Project",
    },
  });

  const ruleset = await createRuleset(project, {
    name: "Dev Solr Ruleset",
  });
  let rvBase = await createRulesetVersion(ruleset, {
    parentId: null,
    value: mockRuleset,
  });
  const rulesetVersionId = rvBase.id;
  // Fake a tree of rulesetVersions
  for (let i = 0; i < 2; i++) {
    rvBase = await createRulesetVersion(ruleset, {
      parentId: rvBase.id,
      value: mockRuleset,
    });
  }
  const rvChildren = [rvBase, rvBase];
  for (let i = 0; i < 2; i++) {
    await createRulesetVersion(ruleset, {
      parentId: rvChildren[i].id,
      value: mockRuleset,
    });
  }

  let qtBase = await createQueryTemplate(project, {
    description: "Solr query template",
    query: "qt=/select&q=#$query#",
  });
  // Fake a tree of revisions
  for (let i = 0; i < 2; i++) {
    qtBase = await updateQueryTemplate(qtBase, {
      description: `Update number ${i + 1}`,
      query: qtBase.query,
    });
  }
  const qtChildren = [qtBase, qtBase];
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < qtChildren.length; j++) {
      qtChildren[j] = await updateQueryTemplate(qtChildren[j], {
        description: `Fork ${j + 1}.${i + 1}`,
        query: qtChildren[j].query,
        tags: [`fork-${j + 1}`],
      });
    }
  }

  const judgement = await prisma.judgement.create({
    data: {
      projectId: project.id,
      name: "Crowd-sourced Judgements",
    },
  });
  const votes = parseVotesCsv(
    fs.readFileSync(seedJudgementFile, "utf-8"),
    "query",
    "docid",
    "rating"
  );
  await setVotes(judgement, votes);

  const sc = await prisma.searchConfiguration.create({
    data: {
      queryTemplate: {
        connect: {
          id: qtChildren[0].id,
        },
      },
      project: {
        connect: { id: project.id },
      },
      judgements: { create: [{ judgementId: judgement.id, weight: 1.0 }] },
      rulesets: {
        connect: {
          id: rulesetVersionId,
        },
      },
      knobs: {},
    },
  });

  // Set sc as active for this project
  await prisma.project.update({
    where: { id: project.id },
    data: {
      activeSearchConfigurationId: sc.id,
    },
  });

  try {
    await createExecution(sc, project.id);
  } catch (error: any) {
    log.error(error.stack ?? error, req, res);
    const { statusCode = 500, data } = error;
    return res.status(statusCode).json({ error: data });
  }

  return res.status(200).json({ success: true });
}

async function handleSeed(
  { user }: ValidUserSession,
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  const org = await prisma.org.findFirst({
    where: userCanAccessOrg(user, {
      id: user.defaultOrgId!,
    }),
  });
  if (!org) {
    return res.status(500).json({ error: "user has no attached org" });
  }

  const searchEndpoint = await createSearchEndpoint(user, {
    orgId: org.id,
    name: "Local Elasticsearch",
    description: "Elasticsearch instance on localhost.",
    resultId: "_id",
    displayFields: ["title:title", "short_description", "image:img_thumb"],
    type: "ELASTICSEARCH",
    info: {
      endpoint: "http://localhost:9200/",
      index: "icecat",
      ignoreSSL: false,
    },
    credentials: null,
  });

  const project = await prisma.project.create({
    data: {
      orgId: org.id,
      searchEndpointId: searchEndpoint.id,
      name: "Dev Project",
    },
  });

  const judgement = await prisma.judgement.create({
    data: {
      projectId: project.id,
      name: "Crowd-sourced Judgements",
    },
  });
  const votes = parseVotesCsv(
    fs.readFileSync(seedJudgementFile, "utf-8"),
    "query",
    "docid",
    "rating"
  );
  await setVotes(judgement, votes);

  const ruleset = await createRuleset(project, {
    name: "Dev Ruleset",
  });
  let rvBase = await createRulesetVersion(ruleset, {
    parentId: null,
    value: mockRuleset,
  });
  const rulesetVersionId = rvBase.id;
  // Fake a tree of rulesetVersions
  for (let i = 0; i < 2; i++) {
    rvBase = await createRulesetVersion(ruleset, {
      parentId: rvBase.id,
      value: mockRuleset,
    });
  }
  const rvChildren = [rvBase, rvBase];
  for (let i = 0; i < 2; i++) {
    await createRulesetVersion(ruleset, {
      parentId: rvChildren[i].id,
      value: mockRuleset,
    });
  }

  let qtBase = await createQueryTemplate(project, {
    description: "Initial query template",
    query: mockQuery,
  });
  // Fake a tree of revisions
  for (let i = 0; i < 2; i++) {
    qtBase = await updateQueryTemplate(qtBase, {
      description: `Update number ${i + 1}`,
      query: qtBase.query,
    });
  }
  const qtChildren = [qtBase, qtBase];
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < qtChildren.length; j++) {
      qtChildren[j] = await updateQueryTemplate(qtChildren[j], {
        description: `Fork ${j + 1}.${i + 1}`,
        query: qtChildren[j].query,
        tags: [`fork-${j + 1}`],
      });
    }
  }

  const sc = await prisma.searchConfiguration.create({
    data: {
      queryTemplate: {
        connect: {
          id: qtChildren[0].id,
        },
      },
      project: {
        connect: { id: project.id },
      },
      judgements: { create: [{ judgementId: judgement.id, weight: 1.0 }] },
      rulesets: {
        connect: {
          id: rulesetVersionId,
        },
      },
      knobs: {},
    },
  });

  // Set sc as active for this project
  await prisma.project.update({
    where: { id: project.id },
    data: {
      activeSearchConfigurationId: sc.id,
    },
  });

  try {
    await createExecution(sc, project.id);
  } catch (error: any) {
    log.error(error.stack ?? error, req, res);
    const { statusCode = 500, data } = error as any;
    return res.status(statusCode).json({ error: data });
  }

  return res.status(200).json({ success: true });
}

type Mutator = (
  user: ValidUserSession,
  req: NextApiRequest,
  res: NextApiResponse
) => Promise<void>;
const routes: { [name: string]: Mutator } = {
  seed: handleSeed,
  solrSeed: handleSolrSeed,
};

export default async function mutate(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "must use POST" });
  }
  const session = await getUser(req);
  if (!session.user) {
    return notAuthorized(res);
  }
  const { name } = req.query;
  const func = routes[name as string];
  if (func) {
    return func(session as ValidUserSession, req, res);
  }

  return notFound(res);
}
