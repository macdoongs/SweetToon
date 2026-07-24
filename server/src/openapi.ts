export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "SweetToon API",
    version: "1.0.0",
    description:
      "웹툰 탐색, 읽기, Mock 소장본 주문과 창작자 발행을 위한 과제용 API입니다.",
  },
  servers: [{ url: "/", description: "현재 서버" }],
  tags: [
    { name: "Reader", description: "작품 탐색과 에피소드 감상" },
    { name: "Orders", description: "Mock 견적과 소장본 주문" },
    { name: "Studio", description: "창작자 ZIP/CBZ 발행" },
  ],
  paths: {
    "/api/series": {
      get: {
        tags: ["Reader"],
        summary: "작품 목록을 페이지 단위로 조회합니다.",
        parameters: [
          {
            name: "filter",
            in: "query",
            schema: {
              type: "string",
              enum: ["all", "ongoing", "collectible"],
              default: "all",
            },
          },
          { name: "genre", in: "query", schema: { type: "string" } },
          {
            name: "weekday",
            in: "query",
            schema: {
              type: "string",
              enum: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
            },
          },
          {
            name: "page",
            in: "query",
            schema: { type: "integer", minimum: 1, default: 1 },
          },
          {
            name: "pageSize",
            in: "query",
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 24,
              default: 12,
            },
          },
        ],
        responses: {
          "200": {
            description: "작품 목록과 필터 facet",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SeriesList" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
        },
      },
    },
    "/api/series/{slug}": {
      get: {
        tags: ["Reader"],
        summary: "작품과 시즌·회차 상세를 조회합니다.",
        parameters: [{ $ref: "#/components/parameters/Slug" }],
        responses: {
          "200": {
            description: "작품 상세",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/episodes/{id}": {
      get: {
        tags: ["Reader"],
        summary: "에피소드 페이지와 이전·다음 화를 조회합니다.",
        description:
          "잠긴 권은 페이지 URL을 반환하지 않습니다. Mock 주문 requestKey를 Bearer 토큰으로 보내면 해당 권을 해금합니다.",
        security: [{ demoEntitlement: [] }, {}],
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: {
          "200": {
            description: "에피소드 리더 데이터",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/print-quotes": {
      post: {
        tags: ["Orders"],
        summary: "선택한 5화 단위 권의 Mock 견적을 계산합니다.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/BookSpec" },
            },
          },
        },
        responses: {
          "200": {
            description: "Mock 견적",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
        },
      },
    },
    "/api/orders": {
      get: {
        tags: ["Orders"],
        summary: "공용 데모 주문 목록을 조회합니다.",
        responses: {
          "200": {
            description: "개인정보가 제외된 주문 목록",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      },
      post: {
        tags: ["Orders"],
        summary: "Mock 소장본 주문을 멱등하게 생성합니다.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/BookSpec" },
                  {
                    type: "object",
                    required: ["requestKey", "ordererName"],
                    properties: {
                      requestKey: { type: "string", format: "uuid" },
                      ordererName: {
                        type: "string",
                        minLength: 2,
                        maxLength: 30,
                      },
                      memo: {
                        type: ["string", "null"],
                        maxLength: 200,
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        responses: {
          "201": {
            description: "생성된 주문",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
        },
      },
    },
    "/api/orders/{id}": {
      get: {
        tags: ["Orders"],
        summary: "주문 사양과 제작 타임라인을 조회합니다.",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: {
          "200": {
            description: "주문 상세",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/orders/{id}/status": {
      patch: {
        tags: ["Orders"],
        summary: "데모 제작 상태를 다음 단계로 변경합니다.",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: {
                  status: {
                    type: "string",
                    enum: ["processing", "shipped", "completed"],
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "변경된 주문" },
          "409": {
            description: "허용되지 않는 상태 전이",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/studio/uploads": {
      post: {
        tags: ["Studio"],
        summary: "ZIP/CBZ를 검증하고 자연 정렬된 미리보기를 만듭니다.",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["archive"],
                properties: {
                  archive: {
                    type: "string",
                    format: "binary",
                    description: "25MB 이하 ZIP 또는 CBZ",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "1시간 동안 유효한 업로드 세션" },
          "400": { $ref: "#/components/responses/BadRequest" },
        },
      },
    },
    "/api/studio/episodes": {
      post: {
        tags: ["Studio"],
        summary: "확인한 페이지 순서로 에피소드를 발행합니다.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: [
                  "sessionId",
                  "seasonId",
                  "number",
                  "title",
                  "pageIds",
                ],
                properties: {
                  sessionId: { type: "string", format: "uuid" },
                  seasonId: { type: "string" },
                  number: { type: "integer", minimum: 1 },
                  title: { type: "string" },
                  pageIds: {
                    type: "array",
                    items: { type: "string", format: "uuid" },
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "발행된 에피소드" },
          "409": { description: "중복 회차 또는 완결 시즌" },
        },
      },
    },
    "/api/studio/series/{seriesId}/access-policy": {
      patch: {
        tags: ["Studio"],
        summary: "작품별 무료 권·추가 미리보기 화 수를 변경합니다.",
        parameters: [
          {
            name: "seriesId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AccessPolicy" },
            },
          },
        },
        responses: {
          "200": { description: "변경된 공개 정책" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      demoEntitlement: {
        type: "http",
        scheme: "bearer",
        description: "Mock 주문 생성 시 브라우저가 보관하는 requestKey",
      },
    },
    parameters: {
      Id: {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
      Slug: {
        name: "slug",
        in: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
        },
      },
    },
    schemas: {
      Error: {
        type: "object",
        required: ["code", "message"],
        properties: {
          code: { type: "string" },
          message: { type: "string" },
        },
      },
      BookSpec: {
        type: "object",
        required: [
          "seasonId",
          "volumeNumber",
          "bookSize",
          "coverType",
          "quantity",
        ],
        properties: {
          seasonId: { type: "string" },
          volumeNumber: { type: "integer", minimum: 1 },
          bookSize: { type: "string", enum: ["A5", "B5"] },
          coverType: {
            type: "string",
            enum: ["softcover", "hardcover"],
          },
          quantity: {
            type: "integer",
            minimum: 1,
            maximum: 50,
          },
        },
      },
      AccessPolicy: {
        type: "object",
        required: ["freeVolumeCount", "previewEpisodeCount"],
        properties: {
          freeVolumeCount: {
            type: "integer",
            minimum: 0,
            maximum: 20,
          },
          previewEpisodeCount: {
            type: "integer",
            minimum: 0,
            maximum: 4,
          },
        },
      },
      SeriesList: {
        type: "object",
        required: ["items", "page", "nextPage", "total", "facets"],
        properties: {
          items: {
            type: "array",
            items: { type: "object", additionalProperties: true },
          },
          page: { type: "integer" },
          nextPage: { type: ["integer", "null"] },
          total: { type: "integer" },
          facets: {
            type: "object",
            additionalProperties: true,
          },
        },
      },
    },
    responses: {
      BadRequest: {
        description: "요청 계약 오류",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      NotFound: {
        description: "대상을 찾을 수 없음",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
    },
  },
} as const;
