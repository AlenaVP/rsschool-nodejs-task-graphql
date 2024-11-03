import { Type } from '@fastify/type-provider-typebox';
import { Post as PrismaPost, PrismaClient, Profile as PrismaProfile, User as PrismaUser  } from '@prisma/client';
import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFloat,
  GraphQLInputObjectType,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString
} from 'graphql';
import { UUIDType } from './types/uuid.js';

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

const prisma = new PrismaClient();

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
    id: { type: new GraphQLNonNull(MemberTypeId) },
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
    },
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
      resolve: async (_, args: { id: string },) => {
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
      resolve: async (_, args: { id: string },) => {
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
      resolve: async (_, args: { id: string },) => {
        try {
          return prisma.profile.findUnique({ where: { id: args.id } });
        } catch (e) {
          return null;
        }
      },
    },
  }),
});

const CreatePostInput = new GraphQLInputObjectType({
  name: 'CreatePostInput',
  fields: {
    title: { type: GraphQLString },
    content: { type: GraphQLString },
    authorId: { type: UUIDType },
  },
});

const CreateUserInput = new GraphQLInputObjectType({
  name: 'CreateUserInput',
  fields: {
    name: { type: GraphQLString },
    balance: { type: GraphQLFloat },
  },
});

const CreateProfileInput = new GraphQLInputObjectType({
  name: 'CreateProfileInput',
  fields: {
    isMale: { type: GraphQLBoolean },
    yearOfBirth: { type: GraphQLInt },
    userId: { type: UUIDType },
    memberTypeId: { type: GraphQLString },
  },
});

const ChangePostInput = new GraphQLInputObjectType({
  name: 'ChangePostInput',
  fields: {
    title: { type: GraphQLString },
  },
});

const ChangeProfileInput = new GraphQLInputObjectType({
  name: 'ChangeProfileInput',
  fields: {
    isMale: { type: GraphQLBoolean },
  },
});

const ChangeUserInput = new GraphQLInputObjectType({
  name: 'ChangeUserInput',
  fields: {
    name: { type: GraphQLString },
  },
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
        _,
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

        // Fetch and return the subscribed user
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

export const schema = new GraphQLSchema({
  query: Query,
  mutation: Mutations,
});
