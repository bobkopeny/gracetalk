import { z } from 'zod';
import { insertPersonaSchema, personas } from './models/persona';
import { conversations, messages } from './models/chat';
import { feedbacks } from './models/feedback';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  personas: {
    list: {
      method: 'GET' as const,
      path: '/api/personas',
      responses: {
        200: z.array(z.custom<typeof personas.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/personas',
      input: insertPersonaSchema,
      responses: {
        201: z.custom<typeof personas.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/personas/:id',
      responses: {
        200: z.custom<typeof personas.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/personas/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  conversations: {
    list: {
      method: 'GET' as const,
      path: '/api/conversations',
      responses: {
        200: z.array(z.custom<typeof conversations.$inferSelect & { personaName: string; messageCount: number; lastMessage: string | null }>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/conversations',
      input: z.object({
        personaId: z.number(),
      }),
      responses: {
        201: z.custom<typeof conversations.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/conversations/:id',
      responses: {
        200: z.custom<typeof conversations.$inferSelect & { messages: typeof messages.$inferSelect[] }>(),
        404: errorSchemas.notFound,
      },
    },
    messages: {
      create: {
        method: 'POST' as const,
        path: '/api/conversations/:id/messages',
        input: z.object({
          content: z.string().optional(),
          audio: z.string().optional(),
          voice: z.string().optional(),
        }),
        responses: {
          201: z.custom<typeof messages.$inferSelect>(),
          404: errorSchemas.notFound,
        },
      },
    },
    feedback: {
      generate: {
        method: 'POST' as const,
        path: '/api/conversations/:id/feedback',
        responses: {
          201: z.custom<typeof feedbacks.$inferSelect>(),
          404: errorSchemas.notFound,
        },
      },
      get: {
        method: 'GET' as const,
        path: '/api/conversations/:id/feedback',
        responses: {
          200: z.custom<typeof feedbacks.$inferSelect>(),
          404: errorSchemas.notFound,
        },
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
