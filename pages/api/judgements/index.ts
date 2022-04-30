import { NextApiRequest, NextApiResponse } from "next";
import csvParser from "csv-parse/lib/sync";
import * as z from "zod";
import { IncomingForm } from "formidable";
import * as fs from "fs";

import { getProject } from "../../../lib/projects";
import {
  formatJudgement,
  getJudgement,
  createJudgementSchema,
  createJudgement,
  updateJudgementSchema,
  updateJudgement,
  setVotesSchema,
  setVotes,
  parseVotesCsv,
  parseVotesTsv,
} from "../../../lib/judgements";
import {
  apiHandler,
  requireMethod,
  requireUser,
  requireBody,
} from "../../../lib/apiServer";
import { notFound } from "../../../lib/errors";
import { ErrorMessage } from "../../../lib/errors/constants";

export const handleCreateJudgement = apiHandler(async (req, res) => {
  requireMethod(req, "POST");
  const user = requireUser(req);
  const { projectId, ...input } = requireBody(
    req,
    createJudgementSchema.extend({
      projectId: z.string(),
    })
  );
  const project = await getProject(user, projectId);
  if (!project) {
    return notFound(res, ErrorMessage.ProjectNotFound);
  }
  const judgement = await createJudgement(project, input);
  res.status(200).json({ judgement: formatJudgement(judgement) });
});

export const handleUpdateJudgement = apiHandler(async (req, res) => {
  requireMethod(req, "POST");
  const user = requireUser(req);
  const { id, ...input } = requireBody(
    req,
    updateJudgementSchema.extend({
      id: z.string(),
    })
  );
  const judgement = await getJudgement(user, id);
  if (!judgement) {
    return notFound(res, ErrorMessage.JudgementNotFound);
  }
  const updated = await updateJudgement(judgement, input);
  res.status(200).json({ judgement: formatJudgement(updated) });
});

export const handleSetVotes = apiHandler(async (req, res) => {
  requireMethod(req, "POST");
  const user = requireUser(req);
  const { id, votes } = requireBody(
    req,
    z.object({
      id: z.string(),
      votes: setVotesSchema,
    })
  );
  const judgement = await getJudgement(user, id);
  if (!judgement) {
    return notFound(res, ErrorMessage.JudgementNotFound);
  }
  await setVotes(judgement, votes);
  res.status(200).json({ success: true });
});

export const handleGetColumns = apiHandler(async (req, res) => {
  requireMethod(req, "POST");
  const columns: string[] = [];
  try {
    const raw = await new Promise<any>((res, rej) => {
      const form = new IncomingForm();
      form.parse(req, (err, fields, files) => {
        if (err) rej(err);
        res({
          fields,
          files,
        });
      });
    });
    const fileType = raw.files?.file?.type;
    const fileContent = fs.readFileSync(raw?.files?.file?.path, {
      encoding: "utf8",
    });
    let parsed;
    switch (fileType) {
      case "text/csv":
        parsed = csvParser(fileContent, {
          columns: true,
          trim: true,
          skip_empty_lines: true,
        });
        break;
      case "text/tab-separated-values":
        parsed = csvParser(fileContent.replaceAll("\t", ","), {
          columns: true,
          trim: true,
          skip_empty_lines: true,
        });
        break;
      default:
        throw new Error("Invalid file type");
    }
    Object.keys(parsed[0]).forEach((column) => columns.push(column));
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
    return;
  }
  res.status(200).json({ success: true, columns });
});

export const handleImport = apiHandler(async (req, res) => {
  requireMethod(req, "POST");
  const data: any = {};
  try {
    const raw = await new Promise<any>((res, rej) => {
      const form = new IncomingForm();
      form.parse(req, (err, fields, files) => {
        if (err) rej(err);
        res({
          fields,
          files,
        });
      });
    });
    const fileType = raw.files?.file?.type;
    switch (fileType) {
      case "text/csv":
        data.fileContent = parseVotesCsv(
          fs.readFileSync(raw?.files?.file?.path, { encoding: "utf8" }),
          raw.fields?.searchPhraseColumn,
          raw.fields?.documentIdColumn,
          raw.fields?.ratingColumn
        );
        break;
      case "text/tab-separated-values":
        data.fileContent = parseVotesTsv(
          fs.readFileSync(raw?.files?.file?.path, { encoding: "utf8" }),
          raw.fields?.searchPhraseColumn,
          raw.fields?.documentIdColumn,
          raw.fields?.ratingColumn
        );
        break;
      default:
        throw new Error("Invalid file type");
    }
    data.projectId = raw?.fields?.projectId;
    data.name = raw?.fields?.name;
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
    return;
  }
  const user = requireUser(req);
  const project = await getProject(user, data.projectId);
  if (!project) {
    return notFound(res, ErrorMessage.ProjectNotFound);
  }
  const judgement = await createJudgement(project, { name: data.name });
  await setVotes(judgement, data.fileContent);
  res.status(200).json({ success: true, id: judgement.id });
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  return res.status(404).json({ error: "not found" });
}
