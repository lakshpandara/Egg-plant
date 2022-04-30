FROM node:16 AS deps

#### Install dependencies
WORKDIR /app
COPY package.json yarn.lock ./
COPY eslint ./eslint
COPY patches/ patches
RUN yarn --frozen-lockfile


FROM node:16 AS schema

WORKDIR /app
COPY --from=deps /app ./
COPY . .

RUN yarn prisma generate

FROM node:16 AS builder
#### Build
ENV DATABASE_URL=postgresql://postgres:example@postgres:5432/postgres?schema=public \
    NEXTAUTH_URL=http://localhost:3000/api/auth \
    SECRET=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= \
    QUERY_EXPANDER_URL=http://localhost:8080 \
    GOOGLE_ID=unset_google_id \
    GOOGLE_SECRET=unset_google_secret \
    CREDENTIALS_SECRET=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= \
    NODE_ENV=production \
    FLICKR_API_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAA \
    REDIS_URL=redis://redis:6379


WORKDIR /app
COPY --from=schema /app ./

RUN yarn build


FROM node:16-alpine
#### Release/minify
ENV NODE_ENV=production

WORKDIR /app

COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/pages ./pages
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/lib ./lib

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
RUN chown -R nextjs:nodejs /app/.next
USER nextjs

EXPOSE 3000
ENTRYPOINT ["yarn"]
CMD ["start"]
