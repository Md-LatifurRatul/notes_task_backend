// One source of truth for the whole API surface. Mirrors every
// mounted route exactly; when a route changes, update this, too.
// Relative server URL: the spec is served by the API itself, so "Try it out"
// always targets this host under the /api mount point in any environment.
const serverUrl = '/api';

const bearerAuth = {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'Access token from /api/auth/login or /api/auth/refresh, sent as `Authorization: Bearer <token>`.'
};

const securitySchemes = { bearerAuth };

function tag(name, description) {
  return { name, description };
}

export const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'Secure Notes API',
    version: '1.0.0',
    description: 'JWT-authenticated note, user and post API with role-based access. All routes sit under /api. JSON only.'
  },
  servers: [{ url: serverUrl, description: 'This server' }],
  tags: [
    tag('Auth', 'Sign up, sign in, refresh tokens and current profile'),
    tag('Users', 'Admin-only user management and aggregation views'),
    tag('Notes', 'User-owned notes; admin can see everyone\'s notes'),
    tag('Posts', 'Public posts by any authenticated user')
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Always returns 200. Used by uptime monitors and load balancers.',
        operationId: 'healthCheck',
        security: [],
        responses: {
          '200': {
            description: 'Service is healthy',
            content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'ok' } } } } }
          }
        }
      }
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        description: 'Creates a regular user. Public registration never accepts or assigns the `admin` role.',
        operationId: 'register',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterInput' },
              examples: {
                minimal: { value: { email: 'reader@example.com', password: 'a-long-unique-password-here' } },
                'with-interests': { value: { email: 'reader@example.com', password: 'a-long-unique-password-here', interests: ['reading', 'chess'] } }
              }
            }
          }
        },
        responses: {
          '201': { description: 'User created', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/AuthResult' } } } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '409': { $ref: '#/components/responses/Conflict' }
        }
      }
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Sign in',
        description: 'Returns the user profile (without password) plus fresh access and refresh tokens. One generic error for unknown email and wrong password.',
        operationId: 'login',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Credentials' } } } },
        responses: {
          '200': { description: 'Signed in', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/AuthResult' } } } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh tokens',
        description: 'Exchanges a valid refresh token for a new access token and a new refresh token. Both are rotated.',
        operationId: 'refresh',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['refreshToken'], properties: { refreshToken: { type: 'string', example: 'eyJ...' } } } } } },
        responses: {
          '200': { description: 'Tokens refreshed', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/AuthResult' } } } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Current profile',
        description: 'Returns the authenticated user\'s profile (without password).',
        operationId: 'getMe',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Current user', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } } } } } } },
          '401': { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },
    '/notes': {
      get: {
        tags: ['Notes'],
        summary: 'List own notes',
        description: 'Returns the authenticated user\'s notes, newest first, with cursor-free pagination.',
        operationId: 'listOwnNotes',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } }
        ],
        responses: {
          '200': { description: 'Paginated own notes', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedNotes' } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' }
        }
      },
      post: {
        tags: ['Notes'],
        summary: 'Create a note',
        description: 'The owner is taken from the authenticated user — it cannot be set from the request body.',
        operationId: 'createNote',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/NoteInput' } } } },
        responses: {
          '201': { description: 'Note created', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/Note' } } } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },
    '/notes/admin/all': {
      get: {
        tags: ['Notes'],
        summary: "Admin: everyone's notes",
        description: 'Admin-only paginated list of every note, newest first.',
        operationId: 'listAllNotes',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } }
        ],
        responses: {
          '200': { description: 'Paginated all notes', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedNotes' } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' }
        }
      }
    },
    '/notes/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: {
        tags: ['Notes'],
        summary: 'Read a note',
        description: 'Owners read any of their notes; admins read any note. A non-owner gets 404 (not 403) so an attacker cannot tell whether the note exists.',
        operationId: 'getNote',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'The note', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/Note' } } } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' }
        }
      },
      patch: {
        tags: ['Notes'],
        summary: 'Update a note',
        description: 'Partial update. One of title or content must change. Owner or admin only.',
        operationId: 'updateNote',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/NoteInput' },        examples: { 'only-title': { value: { title: 'Updated title' } } } } } },
        responses: {
          '200': { description: 'Updated note', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/Note' } } } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' }
        }
      },
      delete: {
        tags: ['Notes'],
        summary: 'Delete a note',
        description: 'Owner or admin only. Returns 204 with no body.',
        operationId: 'deleteNote',
        security: [{ bearerAuth: [] }],
        responses: {
          '204': { description: 'Deleted' },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' }
        }
      }
    },
    '/users': {
      get: {
        tags: ['Users'],
        summary: 'List all users',
        description: 'Admin-only paginated list of all users, newest first.',
        operationId: 'listUsers',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } }
        ],
        responses: {
          '200': { description: 'Paginated users', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedUsers' } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' }
        }
      },
      post: {
        tags: ['Users'],
        summary: 'Create a user',
        description: 'Admin-only. Can create regular users or other administrators.',
        operationId: 'createUser',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UserInput' } } } },
        responses: {
          '201': { description: 'User created', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/User' } } } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '409': { $ref: '#/components/responses/Conflict' }
        }
      }
    },
    '/users/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: {
        tags: ['Users'],
        summary: 'Read a user',
        description: 'Admin-only profile read without the password.',
        operationId: 'getUser',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'User profile', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/User' } } } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' }
        }
      },
      patch: {
        tags: ['Users'],
        summary: 'Update a user',
        description: 'Admin-only. Can change email, password, role or interests. An admin cannot demote their own role.',
        operationId: 'updateUser',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UserInput' },        examples: { 'promote': { value: { role: 'admin' } }, 'change-email': { value: { email: 'new@example.com' } } } } } },
        responses: {
          '200': { description: 'Updated user', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/User' } } } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '409': { $ref: '#/components/responses/Conflict' }
        }
      },
      delete: {
        tags: ['Users'],
        summary: 'Delete a user',
        description: 'Admin-only. A user may not delete their own account. Returns 204.',
        operationId: 'deleteUser',
        security: [{ bearerAuth: [] }],
        responses: {
          '204': { description: 'Deleted' },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' }
        }
      }
    },
    '/users/groups/interests': {
      get: {
        tags: ['Users'],
        summary: 'Users grouped by interests',
        description: 'Admin-only. Unwinds each profile\'s interests, groups users under each interest, sorts alphabetically and returns paginated rows plus total. **Exactly one `User.aggregate()` call** — no `find`, no `countDocuments` and no second aggregation.',
        operationId: 'groupUsersByInterests',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } }
        ],
        responses: {
          '200': { description: 'Paginated interest groups', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedInterestGroups' } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' }
        }
      }
    },
    '/users/{id}/posts': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: {
        tags: ['Users'],
        summary: 'A user\'s posts ($lookup)',
        description: 'Authenticated users only. Runs one aggregation pipeline with a `$lookup` from `users` to `posts` on `author`, returning that user\'s posts with pagination. Posts are visible to every signed-in user, so this route is not admin-gated. Returns 404 for a missing profile.',
        operationId: 'getUserPosts',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } }
        ],
        responses: {
          '200': { description: "Paginated posts by the user", content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedPosts' } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' }
        }
      }
    },
    '/posts': {
      get: {
        tags: ['Posts'],
        summary: 'Public posts',
        description: 'Everyone can read public posts, newest first, with pagination.',
        operationId: 'listPosts',
        security: [],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } }
        ],
        responses: {
          '200': { description: 'Paginated posts', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedPosts' } } } },
          '400': { $ref: '#/components/responses/BadRequest' }
        }
      },
      post: {
        tags: ['Posts'],
        summary: 'Create a post',
        description: 'Authenticated users create a post attributed to their own account.',
        operationId: 'createPost',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PostInput' } } } },
        responses: {
          '201': { description: 'Post created', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/Post' } } } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' }
        }
      }
    }
  }
};

export const components = {
  securitySchemes,
  schemas: {
    Credentials: {
      type: 'object',
      required: ['email', 'password'],
      additionalProperties: false,
      properties: {
        email: { type: 'string', format: 'email', maxLength: 254, example: 'reader@example.com' },
        password: { type: 'string', minLength: 12, maxLength: 72, example: 'a-long-unique-password-here' }
      }
    },
    RegisterInput: {
      allOf: [
        { $ref: '#/components/schemas/Credentials' },
        {
          type: 'object',
          properties: {
            interests: { type: 'array', items: { type: 'string', minLength: 1, maxLength: 40 }, maxItems: 50, example: ['reading', 'chess'] }
          }
        }
      ]
    },
    UserInput: {
      type: 'object',
      required: ['email', 'password'],
      additionalProperties: false,
      properties: {
        email: { type: 'string', format: 'email', maxLength: 254, example: 'newadmin@example.com' },
        password: { type: 'string', minLength: 12, example: 'a-long-unique-password-here' },
        role: { type: 'string', enum: ['user', 'admin'], example: 'user' },
        interests: { type: 'array', items: { type: 'string', minLength: 1, maxLength: 40 }, maxItems: 50, example: ['reading'] }
      }
    },
    NoteInput: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 160, example: 'Meeting notes' },
        content: { type: 'string', maxLength: 100000, example: 'Discussed roadmap and milestones.' }
      }
    },
    PostInput: {
      type: 'object',
      required: ['title', 'body'],
      additionalProperties: false,
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 160, example: 'New feature announcement' },
        body: { type: 'string', minLength: 1, maxLength: 20000, example: 'We shipped the dark mode you asked for.' }
      }
    },
    User: {
      type: 'object',
      properties: {
        _id: { type: 'string', example: '67abcd1234abcd1234abcd1234' },
        email: { type: 'string', format: 'email', example: 'reader@example.com' },
        role: { type: 'string', enum: ['user', 'admin'], example: 'user' },
        interests: { type: 'array', items: { type: 'string' }, example: ['reading', 'chess'] },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' }
      },
      description: 'Password is never included in responses.'
    },
    Note: {
      type: 'object',
      properties: {
        _id: { type: 'string', example: '67abcd1234abcd1234abcd1234' },
        owner: { type: 'string', example: '67abcd1234abcd1234abcd1234' },
        title: { type: 'string', example: 'Meeting notes' },
        content: { type: 'string', example: 'Discussed roadmap and milestones.' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' }
      }
    },
    Post: {
      type: 'object',
      properties: {
        _id: { type: 'string', example: '67abcd1234abcd1234abcd1234' },
        author: { type: 'string', example: '67abcd1234abcd1234abcd1234' },
        title: { type: 'string', example: 'New feature announcement' },
        body: { type: 'string', example: 'We shipped the dark mode you asked for.' },
        createdAt: { type: 'string', format: 'date-time' }
      }
    },
    Pagination: {
      type: 'object',
      properties: {
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 20 },
        total: { type: 'integer', example: 47 },
        pages: { type: 'integer', example: 3 },
        hasNextPage: { type: 'boolean', example: true },
        hasPreviousPage: { type: 'boolean', example: false }
      }
    },
    PaginatedNotes: {
      type: 'object',
      properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Note' } }, pagination: { $ref: '#/components/schemas/Pagination' } }
    },
    PaginatedPosts: {
      type: 'object',
      properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Post' } }, pagination: { $ref: '#/components/schemas/Pagination' } }
    },
    PaginatedUsers: {
      type: 'object',
      properties: { data: { type: 'array', items: { $ref: '#/components/schemas/User' } }, pagination: { $ref: '#/components/schemas/Pagination' } }
    },
    InterestGroup: {
      type: 'object',
      properties: {
        _id: { type: 'string', example: 'chess' },
        users: {
          type: 'array',
          items: { type: 'object', properties: { _id: { type: 'string' }, email: { type: 'string', format: 'email' }, role: { type: 'string', enum: ['user', 'admin'] } } }
        },
        userCount: { type: 'integer', example: 3 }
      }
    },
    PaginatedInterestGroups: {
      type: 'object',
      properties: { data: { type: 'array', items: { $ref: '#/components/schemas/InterestGroup' } }, pagination: { $ref: '#/components/schemas/Pagination' } }
    },
    AuthResult: {
      type: 'object',
      properties: {
        user: { $ref: '#/components/schemas/User' },
        accessToken: { type: 'string', example: 'eyJ...', description: 'Bearer token for protected routes' },
        refreshToken: { type: 'string', example: 'eyJ...', description: 'Send to /api/auth/refresh' },
        tokenType: { type: 'string', example: 'Bearer' }
      }
    }
  },
  responses: {
    BadRequest: { description: 'Validation error — malformed id, bad pagination values or invalid body', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
    Unauthorized: { description: 'Missing, expired or invalid access token', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
    Forbidden: { description: 'Authenticated but not an admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
    NotFound: { description: 'Resource not found (or access denied — see note on /notes/:id)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
    Conflict: { description: 'Duplicate unique value (e.g. email already registered)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } }
  },
  components: {}
};

// Re-export so the shape is valid OpenAPI 3.1: top-level `components`
// is already exported above as `components`, and `responses` references
// `#/components/schemas/Error`. Attach the shared error schema here.
components.schemas.Error = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      required: ['message'],
      properties: {
        message: { type: 'string', example: 'Request validation failed' },
        details: {
          type: 'array',
          items: { type: 'object', properties: { field: { type: 'string' }, message: { type: 'string' } } }
        }
      }
    }
  }
};
