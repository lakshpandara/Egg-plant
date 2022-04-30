import { mockModels } from "../../../lib/__mocks__/prisma";
import { handleCreateRuleset, handleCreateRulesetVersion } from "./index";
import { getApiRoute, TEST_PROJECT, TEST_RULESET_ID } from "../../../lib/test";
import { RuleSetConditionType } from "../../../lib/rulesets/rules";

const testDate = new Date(2000, 0, 1);

describe("api/rulesets", () => {
  it("/create", async () => {
    const initialInfo = {
      projectId: TEST_PROJECT.id,
      name: "My Test Ruleset",
    };
    mockModels("project").action("findFirst").with({}).resolvesTo(TEST_PROJECT);
    mockModels("ruleset")
      .action("create")
      .with({ data: expect.objectContaining(initialInfo) })
      .resolvesTo({
        id: TEST_RULESET_ID,
        ...initialInfo,
        createdAt: testDate,
        updatedAt: testDate,
      });

    const { ruleset } = await getApiRoute(handleCreateRuleset, initialInfo, {
      method: "POST",
    });
    expect(ruleset).toHaveProperty("id");
    expect(ruleset).toMatchObject({
      ...initialInfo,
      createdAt: testDate.toString(),
      updatedAt: testDate.toString(),
    });
  });

  it("/createVersion", async () => {
    mockModels("ruleset")
      .action("findFirst")
      .with({ where: { AND: { id: TEST_RULESET_ID } } })
      .resolvesTo({
        name: "My Test Ruleset ",
        createdAt: testDate,
        updatedAt: testDate,
      });
    mockModels("rulesetVersion")
      .action("create")
      .with({})
      .hasImplementation(({ args: { data } }: any) => ({ ...data, id: 52 }));

    // Test endpoint
    const initialInfo = {
      rulesetId: TEST_RULESET_ID,
      parentId: null,
      value: {
        conditions: [
          {
            type: RuleSetConditionType.RequestHeader,
            key: "key",
            value: "value",
          },
        ],
        rules: [
          {
            expression: "notebook",
            expressionType: "contained",
            isCaseSensitive: false,
            instructions: [],
            enabled: true,
          },
        ],
      },
    };
    const { version } = await getApiRoute(
      handleCreateRulesetVersion,
      initialInfo,
      { method: "POST" }
    );
    expect(version).toHaveProperty("id");
    expect(version.value).toMatchObject(initialInfo.value);
  });
});
