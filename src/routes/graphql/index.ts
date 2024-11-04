import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { graphql, GraphQLError, parse, validate } from 'graphql';
import depthLimit from 'graphql-depth-limit';
import { FastifyRequest } from 'fastify';
import { getLoaders } from './loaders.js';
import { createGqlResponseSchema, getSchema, gqlResponseSchema } from './schemas.js';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
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
      const context = getContext(req, fastify);
      const { query, variables } = req.body;
      const document = parse(query);
      const validationErrors = validate(getSchema(this.prisma), document, [depthLimit(5)]);

      if (validationErrors.length > 0) {
        return {
          errors: validationErrors,
        };
      }

      try {
        const result = await graphql({
          schema: getSchema(this.prisma),
          source: query,
          variableValues: variables,
          contextValue: context,
        });

        return result;
      } catch (error: any) {
        console.error('GraphQL Execution Error:', error);
        return { errors: [new GraphQLError(error.message)] };
      }
    },
  });

  function getContext(_: FastifyRequest, fastify) {
    const { prisma } = fastify;
    const loaders = getLoaders(prisma);

    return {
      prisma,
      loaders,
      fastify,
    };
  }
};

export default plugin;
