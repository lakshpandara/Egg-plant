import { Prisma, mockModels, mockSql } from "../../../lib/__mocks__/prisma";
import {
  getApiRoute,
  TEST_JUDGEMENT,
  TEST_PROJECT,
  TEST_PROJECT_ID,
  TEST_QUERYTEMPLATE,
  TEST_QUERYTEMPLATE_ID,
  TEST_RULESET,
  TEST_SEARCHCONFIGURATION,
  TEST_SEARCHCONFIGURATION_ID,
  TEST_SEARCHCONFIGURATION_JUDGEMENT,
  TEST_SEARCHENDPOINT,
  TEST_SEARCHENDPOINT_ID,
} from "../../../lib/test";
import {
  handleExecuteSearchConfiguration,
  handleUpdateSearchConfiguration,
} from "./index";

const testDate = new Date(2000, 0, 1);

describe("api/searchconfigurations", () => {
  it("/update", async () => {
    const newSearchConfiguration = {
      id: 1,
      queryTemplateId: TEST_QUERYTEMPLATE_ID,
      tags: [],
    };

    mockModels("searchConfiguration")
      .action("findFirst")
      .with({
        where: {
          AND: {
            id: TEST_SEARCHCONFIGURATION_ID,
          },
        },
      })
      .resolvesTo(TEST_SEARCHCONFIGURATION);

    mockModels("queryTemplate")
      .action("findFirst")
      .with({
        where: {
          AND: { id: TEST_QUERYTEMPLATE_ID },
        },
      })
      .resolvesTo(TEST_QUERYTEMPLATE);

    mockModels("judgementSearchConfiguration")
      .action("findFirst")
      .with({
        where: { searchConfigurationId: TEST_SEARCHCONFIGURATION_ID },
      })
      .resolvesTo({
        ...TEST_SEARCHCONFIGURATION_JUDGEMENT,
        judgement: TEST_JUDGEMENT,
      });

    mockModels("project")
      .action("findFirst")
      .with({ where: { AND: { id: TEST_PROJECT_ID } } })
      .resolvesTo(TEST_PROJECT);

    mockModels("searchEndpoint")
      .action("findFirst")
      .with({ where: { AND: { id: TEST_SEARCHENDPOINT_ID } } })
      .resolvesTo(TEST_SEARCHENDPOINT);

    mockModels("searchConfiguration")
      .action("create")
      .with({
        data: {
          queryTemplate: { connect: { id: TEST_QUERYTEMPLATE_ID } },
          judgements: {
            create: [
              {
                judgementId: TEST_JUDGEMENT.id,
                weight: TEST_SEARCHCONFIGURATION_JUDGEMENT.weight,
              },
            ],
          },
          rulesets: {
            connect: [],
          },
        },
      })
      .resolvesTo({
        ...newSearchConfiguration,
        createdAt: testDate,
      });

    const { searchConfiguration } = await getApiRoute(
      handleUpdateSearchConfiguration,
      {
        id: TEST_SEARCHCONFIGURATION_ID,
        queryTemplateId: TEST_QUERYTEMPLATE_ID,
      },
      { method: "POST" }
    );

    expect(searchConfiguration).toHaveProperty("id");
    expect(searchConfiguration).toMatchObject({
      id: newSearchConfiguration.id,
      tags: newSearchConfiguration.tags,
      createdAt: testDate.toString(),
    });
  });

  it.skip("/execute", async () => {
    const newExecution = {
      id: 1,
      searchConfigurationId: TEST_SEARCHCONFIGURATION_ID,
      createdAt: "2050-12-31",
    };

    mockModels("searchConfiguration")
      .action("findFirst")
      .with({ where: { AND: { id: TEST_SEARCHCONFIGURATION_ID } } })
      .resolvesTo({
        ...TEST_SEARCHCONFIGURATION,
        queryTemplate: { projectId: TEST_PROJECT_ID },
      });

    mockModels("queryTemplate")
      .action("findFirst")
      .with({
        where: {
          searchConfigurations: { some: { id: TEST_SEARCHCONFIGURATION_ID } },
        },
      })
      .resolvesTo(TEST_QUERYTEMPLATE);

    mockModels("searchEndpoint")
      .action("findFirst")
      .with({
        where: {
          projects: {
            some: {
              queryTemplates: {
                some: {
                  id: TEST_QUERYTEMPLATE_ID,
                },
              },
            },
          },
        },
      })
      .resolvesTo(TEST_SEARCHENDPOINT);

    mockModels("rulesetVersion")
      .action("findMany")
      .with({
        where: {
          searchConfigurations: { some: { id: TEST_SEARCHCONFIGURATION_ID } },
        },
      })
      .resolvesTo(TEST_RULESET);

    mockSql("$queryRaw")
      .with(
        Prisma.sql`
SELECT JP."phrase", V."documentId", SUM(JSC."weight" * V."score") / SUM(JSC."weight") AS "score"
    FROM "JudgementSearchConfiguration" AS JSC
    INNER JOIN "JudgementPhrase" AS JP
    ON JP."judgementId" = JSC."judgementId"
    LEFT JOIN "Vote" AS V
    ON V."judgementPhraseId" = JP."id"
    WHERE JSC."searchConfigurationId" = ${TEST_SEARCHCONFIGURATION_ID}
    GROUP BY JP."phrase", V."documentId"
    ORDER BY JP."phrase", V."documentId"`
      )
      .resolvesTo([]);

    mockModels("execution")
      .action("create")
      .with({
        data: {
          searchConfigurationId: TEST_SEARCHCONFIGURATION_ID,
          projectId: TEST_PROJECT_ID,
          meta: {},
          combinedScore: 0,
          allScores: {},
          phrases: { create: [] },
        },
      })
      .resolvesTo(newExecution);

    const { execution } = await getApiRoute(
      handleExecuteSearchConfiguration,
      { id: TEST_SEARCHCONFIGURATION_ID },
      { method: "POST" }
    );

    expect(execution).toHaveProperty("id");
    expect(execution).toMatchObject(newExecution);
  });
});
