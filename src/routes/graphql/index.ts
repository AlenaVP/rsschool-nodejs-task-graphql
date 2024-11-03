import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { createGqlResponseSchema, gqlResponseSchema } from './schemas.js';
import {
  graphql,
  parse,
  validate,
  GraphQLEnumType,
  GraphQLFloat,
  GraphQLInt,
  GraphQLList,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  GraphQLBoolean,
  GraphQLNonNull
} from 'graphql';
import depthLimit from 'graphql-depth-limit';
import { PrismaClient } from '@prisma/client';
import { UUIDType } from './types/uuid.js';

const MemberTypeId = new GraphQLEnumType({
  name: 'MemberTypeId',
  values: {
    BASIC: { value: 'BASIC' },
    BUSINESS: { value: 'BUSINESS' },
  },
});

const MemberType = new GraphQLObjectType({
  name: 'MemberType',
  fields: () => ({
    id: { type: MemberTypeId },
    discount: { type: GraphQLFloat },
    postsLimitPerMonth: { type: GraphQLInt },
  }),
});

const Post = new GraphQLObjectType({
  name: 'Post',
  fields: () => ({
    id: { type: GraphQLString },
    title: { type: GraphQLString },
    content: { type: GraphQLString },
  }),
});

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { prisma } = fastify;

  const User = new GraphQLObjectType({
    name: 'User',
    fields: () => ({
      id: { type: GraphQLString },
      name: { type: GraphQLString },
      balance: { type: GraphQLFloat },
      profile: {
        type: Profile,
        resolve: (root: { id: string }) => {
          return prisma.profile.findUnique({
            where: {
              userId: root.id,
            },
          });
        },
      },
      posts: {
        type: new GraphQLList(Post),
        resolve: (root: { id: string }) => {
          return prisma.post.findMany({
            where: {
              authorId: root.id,
            },
          });
        },
      },
      userSubscribedTo: {
        type: new GraphQLList(UserSubscribedTo),
        resolve: (root: { id: string }) => {
          return prisma.user.findMany({
            where: {
              subscribedToUser: {
                some: {
                  subscriberId: root.id,
                },
              },
            },
          });
        },
      },
      subscribedToUser: {
        type: new GraphQLList(SubscribedToUser),
        resolve: (root: { id: string }) => {
          return prisma.user.findMany({
            where: {
              userSubscribedTo: {
                some: {
                  authorId: root.id,
                },
              },
            },
          });
        },
      },
    }),
  });

  const SubscribedToUser = new GraphQLObjectType({
    name: 'SubscribedToUser',
    fields: () => ({
      id: { type: GraphQLString },
      userSubscribedTo: {
        type: new GraphQLList(UserSubscribedTo),
        resolve: (root: { id: string }) => {
          return prisma.user.findMany({
            where: {
              subscribedToUser: {
                some: {
                  subscriberId: root.id,
                },
              },
            },
          });
        },
      },
    }),
  });

  const UserSubscribedTo = new GraphQLObjectType({
    name: 'UserSubscribedTo',
    fields: () => ({
      id: { type: GraphQLString },
      subscribedToUser: {
        type: new GraphQLList(SubscribedToUser),
        resolve: (root: { id: string }) => {
          return prisma.user.findMany({
            where: {
              userSubscribedTo: {
                some: {
                  authorId: root.id,
                },
              },
            },
          });
        },
      }
    }),
  });

  const Profile = new GraphQLObjectType({
    name: 'Profile',
    fields: () => ({
      id: { type: GraphQLString },
      isMale: { type: GraphQLBoolean },
      yearOfBirth: { type: GraphQLInt },
      memberType: {
        type: MemberType,
        resolve(root: { memberTypeId: string }) {
          return prisma.memberType.findUnique({ where: { id: root.memberTypeId } });
        },
      },
    }),
  });

  const Query = new GraphQLObjectType({
    name: 'Query',
    fields: () => ({
      memberTypes: {
        type: new GraphQLList(MemberType),
        resolve: async () => {
          return prisma.memberType.findMany();
        },
      },
      posts: {
        type: new GraphQLList(Post),
        resolve: async () => {
          return prisma.post.findMany();
        },
      },
      users: {
        type: new GraphQLList(User),
        resolve: async () => {
          return prisma.user.findMany();
        },
      },
      profiles: {
        type: new GraphQLList(Profile),
        resolve: async () => {
          return prisma.profile.findMany();
        },
      },
      memberType: {
        type: MemberType,
        args: {
          id: { type: new GraphQLNonNull(MemberTypeId) },
        },
        resolve: async (
          root,
          args: { id: string },
          context: { prisma: PrismaClient },
        ) => {
          try {
            return context.prisma.memberType.findUnique({ where: { id: args.id } });
          } catch (e) {
            return null;
          }
        },
      },
      post: {
        type: Post,
        args: {
          id: { type: new GraphQLNonNull(UUIDType) },
        },
        resolve: async (_, args: { id: string }) => {
          try {
            return prisma.post.findUnique({ where: { id: args.id } });
          } catch (e) {
            return null;
          }
        },
      },
      user: {
        type: User,
        args: {
          id: { type: new GraphQLNonNull(UUIDType) },
        },
        resolve: async (_, args: { id: string }) => {
          try {
            return prisma.user.findUnique({ where: { id: args.id } });
          } catch (e) {
            return null;
          }
        },
      },
      profile: {
        type: Profile,
        args: {
          id: { type: new GraphQLNonNull(UUIDType) },
        },
        resolve: async (_, args: { id: string }) => {
          try {
            return prisma.profile.findUnique({ where: { id: args.id } });
          } catch (e) {
            return null;
          }
        },
      },
    }),
  });

  const schema = new GraphQLSchema({ query: Query });

  fastify.route({
    url: '/',
    method: 'POST',
    schema: {
      ...createGqlResponseSchema,
      response: {
        200: gqlResponseSchema,
      },
    },
    async handler(req) {
      const { query, variables } = req.body;
      const document = parse(query);
      const validationErrors = validate(schema, document, [depthLimit(5)]);

      if (validationErrors.length > 0) {
        return {
          data: null,
          errors: validationErrors,
        };
      }

      try {
        const result = await graphql({
          schema: schema,
          source: query,
          variableValues: variables,
          contextValue: { prisma },
        });

        return {
          data: result.data,
          errors: result.errors ?? null,
        };
      } catch (error) {
        return {
          data: null,
          errors: [error],
        };
      };
    },
  });
};

export default plugin;
