import { IncomingMessage } from "http";
import { NextAuthOptions, Session } from "next-auth";
import Providers from "next-auth/providers";
import Adapters from "next-auth/adapters";
import { getSession } from "next-auth/client";
import { NextApiRequest } from "next";
import { isExpired } from "./users/apikey";
import { getCookies } from "./cookies";
import prisma, { OrgType, User, UserOrgRole } from "./prisma";
import { requireEnv } from "./env";
import { ExposedProject, formatProject, listProjects } from "./projects";
import { ExposedOrg, formatOrg, listOrgs, userCanAccessOrg } from "./org";
import { AUTH_CONSTANTS, isAuthTypeEnabled } from "./authSources";
import * as log from "./logging";
import { deleteInvitation, getInvitation } from "./invitation";

const IS_DEV = process.env.NODE_ENV === "development";

export type ValidUserSession = {
  session: Session;
  user: User;
  orgs: ExposedOrg[];
  projects: ExposedProject[];
};

export type UserSession = Partial<ValidUserSession>;

const nextAuthSecret = requireEnv("SECRET");

export const authOptions = (req: NextApiRequest): NextAuthOptions => ({
  providers: [
    Providers.Google({
      clientId: AUTH_CONSTANTS.googleId,
      clientSecret: AUTH_CONSTANTS.googleSecret,
    }),
    // Add GitHub auth if enabled
    ...(isAuthTypeEnabled("github")
      ? [
          Providers.GitHub({
            clientId: AUTH_CONSTANTS.githubId,
            clientSecret: AUTH_CONSTANTS.githubSecret,
          }),
        ]
      : []),
    // Add Atlassian auth if enabled
    ...(isAuthTypeEnabled("atlassian")
      ? [
          Providers.Atlassian({
            clientId: AUTH_CONSTANTS.atlassianId,
            clientSecret: AUTH_CONSTANTS.atlassianSecret,
            scope: "read:jira-user offline_access read:me",
          }),
        ]
      : []),
    // Add Azure AD auth if enabled
    ...(isAuthTypeEnabled("azureAd")
      ? [
          Providers.AzureADB2C({
            clientId: AUTH_CONSTANTS.azureAdId,
            clientSecret: AUTH_CONSTANTS.azureAdSecret,
            tenantId: AUTH_CONSTANTS.azureAdTenantId,
            scope: "offline_access User.Read",
          }),
        ]
      : []),
    // Add BitBucket auth if enabled
    ...(isAuthTypeEnabled("gitlab")
      ? [
          Providers.GitLab({
            clientId: AUTH_CONSTANTS.gitlabId,
            clientSecret: AUTH_CONSTANTS.gitlabSecret,
          }),
        ]
      : []),
  ],
  adapter: Adapters.Prisma.Adapter({ prisma }),
  secret: nextAuthSecret,
  callbacks: {
    async session(session: Session, user: User) {
      // For some reason next auth doesn't include this by default.
      (session as any).user.id = (user as any).id;

      // We stuff some extra values in the session as well
      const orgs = await prisma.org.findMany({
        where: userCanAccessOrg(user),
      });

      let { activeOrgId } = getCookies(req);
      if (!activeOrgId) {
        activeOrgId = user.defaultOrgId as string;
      }
      const activeOrg = orgs.find((o) => o.id === activeOrgId) || orgs[0];

      const projects = (activeOrg ? await listProjects(activeOrg) : []).map(
        formatProject
      );

      return { ...session, orgs: orgs.map(formatOrg), projects, activeOrgId };
    },
    async signIn(user: any, account: any, profile: any) {
      // Only users who already have an account have the "active" flag
      if (user.active !== undefined) {
        return user.active;
      }

      // TODO check cookie only if request came from invite url
      const email = profile.email ?? "";
      const invitationId = req.cookies.invitationId ?? "";
      const invitation = await getInvitation(invitationId, {
        expiresAt: { gt: new Date(Date.now()) },
        email,
      });

      // Allow bdbq personnel to sign up and create their own user space
      if (!invitation && email.endsWith(`@bigdataboutique.com`)) {
        return true;
      }

      if (IS_DEV && !invitation) {
        return true;
      }

      return !!invitation;
    },
  },
  events: {
    async createUser(user: any) {
      await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          active: true,
        },
      });

      const invitationId = req.cookies.invitationId ?? "";
      const invitation = await getInvitation(invitationId, {
        email: user.email,
      });
      if (invitation?.orgId) {
        await prisma.orgUser.create({
          data: {
            role: invitation.role!,
            user: {
              connect: {
                email: user.email,
              },
            },
            org: {
              connect: {
                id: invitation.orgId,
              },
            },
          },
        });
      } else {
        await prisma.org.create({
          data: {
            name: `${user.name}'s Space`,
            orgType: OrgType.USER_SPACE,
            users: {
              create: {
                userId: user.id,
                role: "ADMIN" as UserOrgRole,
              },
            },
          },
        });
      }
      invitation && (await deleteInvitation(invitation.id));
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
});

async function initAuth(req: IncomingMessage): Promise<UserSession | null> {
  let session = (await getSession({ req })) as UserSession | null;

  if (!session) {
    // Attempt API Key authentication if there's no user session.
    let apikey = req.headers["authorization"];
    if (!apikey) {
      return null;
    }
    if (apikey.startsWith("Bearer ")) {
      apikey = apikey.substr(7).trim();
    }
    const apikeyObject = await prisma.apiKey.findFirst({
      where: { apikey },
    });
    if (!apikeyObject) {
      log.info("API Key not found: " + apikey);
      return null;
    }
    if (isExpired(apikeyObject)) {
      log.info("API Key has expired");
      return null;
    }
    if (apikeyObject.disabled) {
      log.info("API Key is disabled");
      return null;
    }
    const user = {
      id: apikeyObject.userId,
    };
    // Temp hack to find orgs for a user connecting via api key
    const orgs = await listOrgs(user as User);
    session = {
      user: user as User,
      orgs: orgs,
    };
  }

  return session;
}

export async function getUser(req: IncomingMessage): Promise<UserSession> {
  const session = await initAuth(req);

  if (!session) {
    return {};
  }

  const userId = session.user?.id;
  if (!userId) {
    return { session };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user) {
    // XXX - this is a critical error meaning our session is corrupt!
    return { session };
  }

  if (!user.defaultOrgId) {
    // We have to have a default Org or else we can't show any resources.
    // Currently there's no way in UI to set user.defaultOrgId, but it is required for apikey authentication to work
    const userWithDefaultOrg = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        defaultOrgId: session.orgs?.[0]?.id ?? null,
      },
    });
    if (!userWithDefaultOrg.defaultOrgId) {
      throw new Error("User has no Orgs!");
    }
  }
  return { session, user };
}
