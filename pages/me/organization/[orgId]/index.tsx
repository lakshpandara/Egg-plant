import * as React from "react";

import Typography from "@material-ui/core/Typography";
import { Grid } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import EditIcon from "@material-ui/icons/Edit";

import { authenticatedPage, requireParam } from "../../../../lib/pageHelpers";
import BreadcrumbsButtons from "../../../../components/common/BreadcrumbsButtons";
import Link, { LinkButton } from "../../../../components/common/Link";
import { ExposedOrg, formatOrg, getOrg } from "../../../../lib/org";
import { CreateOrganizationForm } from "../../../../components/organization/CreateOrganizationForm";
import { apiRequest } from "../../../../lib/api";
import { useRouter } from "next/router";
import { useSession } from "../../../../components/Session";

export const getServerSideProps = authenticatedPage(async (context) => {
  const orgId = requireParam(context, "orgId");
  const organization = await getOrg(context.user, orgId);
  return {
    props: {
      org: organization && formatOrg(organization),
      isUserScoped: organization?.orgType === "USER_SPACE",
    },
  };
});

const useStyles = makeStyles(() => ({
  headerWrapper: {
    display: "flex",
    justifyContent: "space-between",
  },
}));

type Props = {
  org: ExposedOrg;
  isUserScoped: boolean;
};

export default function EditOrganization({ org, isUserScoped }: Props) {
  const classes = useStyles();
  const router = useRouter();
  const { refresh } = useSession();
  async function onSubmit({
    name,
    image,
    domain,
    bgColor,
    textColor,
  }: ExposedOrg) {
    await apiRequest(`/api/organization/update/${org.id}`, {
      name: name || null,
      image: org.image === image ? undefined : image || null,
      domain: domain || null,
      bgColor: bgColor || null,
      textColor: textColor || null,
    });
    refresh();
    router.push("/me");
    // Keep the form stuck as pending
    return new Promise(() => {});
  }

  return (
    <div>
      <BreadcrumbsButtons>
        <Link href="/">Home</Link>
        <Link href="/me">Organization</Link>
        <Typography>{org.name}</Typography>
      </BreadcrumbsButtons>
      <Grid container spacing={3}>
        <Grid item xs={12} className={classes.headerWrapper}>
          <Typography variant="h4">Edit Organization</Typography>
          {org.orgType !== "USER_SPACE" && (
            <LinkButton
              variant="outlined"
              startIcon={<EditIcon />}
              size="medium"
              href={`${org.id}/users`}
            >
              Manage Users
            </LinkButton>
          )}
        </Grid>
        <Grid item xs={12}>
          <Typography variant="h6">Organization details</Typography>
        </Grid>
        <Grid item xs={7}>
          <CreateOrganizationForm
            onSubmit={onSubmit}
            initialValues={org}
            isUserScoped={isUserScoped}
          />
        </Grid>
      </Grid>
    </div>
  );
}
