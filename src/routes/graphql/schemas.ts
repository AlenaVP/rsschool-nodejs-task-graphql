import { Type } from '@fastify/type-provider-typebox';
import { Post as PrismaPost, PrismaClient, Profile as PrismaProfile, User as PrismaUser } from '@prisma/client';
import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString
} from 'graphql';
import { parseResolveInfo, ResolveTree, simplifyParsedResolveInfoFragmentWithType } from 'graphql-parse-resolve-info';

import { getLoaders } from './loaders.js';
import { MemberType, MemberTypeId } from './types/member.js';
import { Post } from './types/post.js';
import { Profile } from './types/profile.js';
import { UUIDType } from './types/uuid.js';
import {
  ChangePostInput,
  ChangeProfileInput,
  ChangeUserInput,
  CreatePostInput,
  CreateProfileInput,
  CreateUserInput
} from './types/input-types.js';

export const gqlResponseSchema = Type.Partial(
  Type.Object({
    data: Type.Any(),
    errors: Type.Any(),
  }),
);

export const createGqlResponseSchema = {
  body: Type.Object(
    {
      query: Type.String(),
      variables: Type.Optional(Type.Record(Type.String(), Type.Any())),
    },
    {
      additionalProperties: false,
    },
  ),
};

export function getSchema(prisma: PrismaClient) {
  const {
    postsLoader,
    profileLoader,
    subscribedToUserLoader,
    userSubscribedToLoader,
    usersLoader,
  } = getLoaders(prisma);

  const User = new GraphQLObjectType({
    name: 'User',
    fields: () => ({
      id: { type: GraphQLString },
      name: { type: GraphQLString },
      balance: { type: GraphQLFloat },
      profile: {
        type: Profile,
        resolve: (root: { id: string }) => {
          return profileLoader.load(root.id);
        },
      },
      posts: {
        type: new GraphQLList(Post),
        resolve: async (root: { id: string }) => {
          return postsLoader.load(root.id);
        },
      },
      userSubscribedTo: {
        type: new GraphQLList(UserSubscribedTo),
        resolve: async (root) => {
          const subs = await userSubscribedToLoader.load(root.id);

          return usersLoader.loadMany(subs);
        },
      },
      subscribedToUser: {
        type: new GraphQLList(SubscribedToUser),
        resolve: async (root: { id: string }) => {
          const subs = await subscribedToUserLoader.load(root.id);

          return usersLoader.loadMany(subs);
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
        resolve: async (root: { id: string }) => {
          const subs = await userSubscribedToLoader.load(root.id);

          return usersLoader.loadMany(subs);
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
        resolve: async (root: { id: string }) => {
          const subs = await subscribedToUserLoader.load(root.id);

          return usersLoader.loadMany(subs);
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
        resolve: async (root, args, context, resolveInfo) => {
          const info = parseResolveInfo(resolveInfo);
          const { fields } = simplifyParsedResolveInfoFragmentWithType(
            info as ResolveTree,
            User,
          );

          const includeUserSubscribedTo = !!fields['userSubscribedTo'];
          const includeSubscribedToUser = !!fields['subscribedToUser'];

          const users = await prisma.user.findMany({
            include: {
              userSubscribedTo: includeUserSubscribedTo,
              subscribedToUser: includeSubscribedToUser,
            },
          });

          for (const user of users) {
            usersLoader.prime(user.id, user);

            if (includeUserSubscribedTo) {
              userSubscribedToLoader.prime(
                user.id,
                user.userSubscribedTo.map(({ authorId }) => authorId),
              );
            }

            if (includeSubscribedToUser) {
              subscribedToUserLoader.prime(
                user.id,
                user.subscribedToUser.map(({ subscriberId }) => subscriberId),
              );
            }
          }

          return users;
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
        resolve: async (_, args: { id: string }, context: { prisma: PrismaClient }) => {
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

  const Mutations = new GraphQLObjectType({
    name: 'Mutation',
    fields: () => ({
      createUser: {
        type: User,
        args: {
          dto: { type: new GraphQLNonNull(CreateUserInput) },
        },
        async resolve(_, { dto }: { dto: { name: string; balance: number } }) {
          const createdUser = await prisma.user.create({
            data: {
              name: dto.name,
              balance: dto.balance,
            },
          });
          return createdUser;
        },
      },
      createProfile: {
        type: Profile,
        args: {
          dto: { type: new GraphQLNonNull(CreateProfileInput) },
        },
        async resolve(
          parent,
          {
            dto,
          }: {
            dto: {
              isMale: boolean;
              yearOfBirth: number;
              userId: string;
              memberTypeId: string;
            };
          },
        ) {
          const authorExists = await prisma.user.findUnique({
            where: {
              id: dto.userId,
            },
          });

          if (!authorExists) {
            throw new Error(`User with id ${dto.userId} does not exist.`);
          }

          const createdProfile = await prisma.profile.create({
            data: {
              isMale: dto.isMale,
              yearOfBirth: dto.yearOfBirth,
              userId: dto.userId,
              memberTypeId: dto.memberTypeId,
            },
          });
          return createdProfile;
        },
      },
      createPost: {
        type: Post,
        args: {
          dto: { type: new GraphQLNonNull(CreatePostInput) },
        },
        async resolve(_, { dto }: { dto: { title: string; content: string; authorId: string } }) {
          const authorExists = await prisma.user.findUnique({
            where: {
              id: dto.authorId,
            },
          });

          if (!authorExists) {
            throw new Error(`Author with id ${dto.authorId} does not exist.`);
          }

          const createdPost = await prisma.post.create({
            data: {
              title: dto.title,
              content: dto.content,
              authorId: dto.authorId,
            },
          });
          return createdPost;
        },
      },
      deletePost: {
        type: GraphQLBoolean,
        args: {
          id: { type: new GraphQLNonNull(UUIDType) },
        },
        async resolve(_, { id }: { id: string }) {
          try {
            await prisma.post.delete({
              where: {
                id: id,
              },
            });
            return true;
          } catch (error) {
            return false;
          }
        },
      },
      deleteProfile: {
        type: GraphQLBoolean,
        args: {
          id: { type: new GraphQLNonNull(UUIDType) },
        },
        async resolve(_, { id }: { id: string }) {
          try {
            await prisma.profile.delete({
              where: {
                id: id,
              },
            });
            return true;
          } catch (error) {
            return false;
          }
        },
      },
      deleteUser: {
        type: GraphQLBoolean,
        args: {
          id: { type: new GraphQLNonNull(UUIDType) },
        },
        async resolve(_, { id }: { id: string }) {
          try {
            await prisma.user.delete({
              where: {
                id: id,
              },
            });
            return true;
          } catch (error) {
            return false;
          }
        },
      },
      changePost: {
        type: Post,
        args: {
          id: { type: new GraphQLNonNull(UUIDType) },
          dto: { type: new GraphQLNonNull(ChangePostInput) },
        },

        async resolve(_, { id, dto }: { id: string; dto: PrismaPost }) {
          const updatedPost = await prisma.post.update({
            where: {
              id: id,
            },
            data: {
              ...dto,
            },
          });
          return updatedPost;
        },
      },
      changeProfile: {
        type: Profile,
        args: {
          id: { type: new GraphQLNonNull(UUIDType) },
          dto: { type: new GraphQLNonNull(ChangeProfileInput) },
        },
        async resolve(_, { id, dto }: { id: string; dto: PrismaProfile }) {
          const updatedProfile = await prisma.profile.update({
            where: {
              id: id,
            },
            data: {
              ...dto,
            },
          });
          return updatedProfile;
        },
      },
      changeUser: {
        type: User,
        args: {
          id: { type: new GraphQLNonNull(UUIDType) },
          dto: { type: new GraphQLNonNull(ChangeUserInput) },
        },
        async resolve(_, { id, dto }: { id: string; dto: PrismaUser }) {
          const updatedUser = await prisma.user.update({
            where: {
              id: id,
            },
            data: {
              ...dto,
            },
          });
          return updatedUser;
        },
      },
      subscribeTo: {
        type: User,
        args: {
          userId: { type: new GraphQLNonNull(UUIDType) },
          authorId: { type: new GraphQLNonNull(UUIDType) },
        },
        async resolve(_, { userId, authorId }: { userId: string; authorId: string }) {
          await prisma.user.update({
            where: {
              id: userId,
            },
            data: {
              userSubscribedTo: {
                create: {
                  authorId: authorId,
                },
              },
            },
          });

          const subscribedUser = await prisma.user.findUnique({ where: { id: userId } });
          return subscribedUser;
        },
      },
      unsubscribeFrom: {
        type: GraphQLBoolean,
        args: {
          userId: { type: new GraphQLNonNull(UUIDType) },
          authorId: { type: new GraphQLNonNull(UUIDType) },
        },
        async resolve(_, { userId, authorId }: { userId: string; authorId: string }) {
          try {
            await prisma.subscribersOnAuthors.delete({
              where: {
                subscriberId_authorId: {
                  subscriberId: userId,
                  authorId: authorId,
                },
              },
            });
            return true;
          } catch (error) {
            return false;
          }
        },
      },
    }),
  });

  const schema = new GraphQLSchema({
    query: Query,
    mutation: Mutations,
  });

  return schema;
}
