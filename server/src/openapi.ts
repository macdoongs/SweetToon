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
    {
      name: "Realtime",
      description: "현재 독자, 실시간 인기 작품과 데모 봇",
    },
    { name: "Candy", description: "익명 데모 캔디 지갑과 회차 해금" },
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
              maximum: 100,
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
          "잠긴 권은 페이지 URL을 반환하지 않습니다. Mock 주문 생성 응답의 entitlementToken 또는 캔디 지갑 토큰을 Bearer 토큰으로 보내면 보유 권한을 확인합니다.",
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
    "/api/series/{slug}/presence": {
      post: {
        tags: ["Realtime"],
        summary: "익명 독자의 작품 열람 presence를 갱신합니다.",
        parameters: [{ $ref: "#/components/parameters/Slug" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["sessionId"],
                properties: {
                  sessionId: { type: "string", format: "uuid" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "최근 1분 동안의 현재 독자 수",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/realtime/popular": {
      get: {
        tags: ["Realtime"],
        summary: "현재 독자가 있는 작품을 실시간 순위로 조회합니다.",
        responses: {
          "200": {
            description: "현재 독자 수가 높은 작품 목록",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      },
    },
    "/api/realtime/demo-bot": {
      get: {
        tags: ["Realtime"],
        summary: "실시간 데모 봇의 실행 상태를 조회합니다.",
        responses: {
          "200": {
            description: "봇 인원, 속도와 최근 실행 상태",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DemoBotStatus" },
              },
            },
          },
        },
      },
      patch: {
        tags: ["Realtime"],
        summary: "실시간 데모 봇을 시작·중지하거나 속도를 변경합니다.",
        security: [{ operationsApiKey: [] }, {}],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  running: { type: "boolean" },
                  readerCount: {
                    type: "integer",
                    minimum: 0,
                    maximum: 30,
                  },
                  speed: {
                    type: "string",
                    enum: ["slow", "normal", "fast"],
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "변경된 데모 봇 상태",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DemoBotStatus" },
              },
            },
          },
          "409": {
            description: "현재 환경에서 데모 봇이 비활성화됨",
          },
        },
      },
    },
    "/api/realtime/demo-bot/reset": {
      post: {
        tags: ["Realtime"],
        summary: "봇이 만든 presence와 주문만 초기화합니다.",
        security: [{ operationsApiKey: [] }, {}],
        responses: {
          "200": {
            description: "초기화 후 데모 봇 상태",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DemoBotStatus" },
              },
            },
          },
        },
      },
    },
    "/api/candy-wallets/{token}": {
      get: {
        tags: ["Candy"],
        summary: "브라우저의 익명 캔디 잔액을 조회합니다.",
        parameters: [
          {
            name: "token",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "캔디 잔액과 개당 가격",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CandyWallet" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
        },
      },
      post: {
        tags: ["Candy"],
        summary: "고정 패키지의 데모 캔디를 Mock 충전합니다.",
        description:
          "실제 결제를 수행하지 않으며 요청 키를 기준으로 멱등하게 캔디 원장에 반영합니다.",
        parameters: [
          {
            name: "token",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["requestKey", "candyAmount"],
                properties: {
                  requestKey: { type: "string", format: "uuid" },
                  candyAmount: {
                    type: "integer",
                    enum: [10, 30, 50],
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Mock 충전 결과와 현재 잔액",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/CandyWallet" },
                    {
                      type: "object",
                      required: [
                        "chargedCandy",
                        "price",
                        "currency",
                        "mock",
                        "charged",
                      ],
                      properties: {
                        chargedCandy: {
                          type: "integer",
                          enum: [10, 30, 50],
                        },
                        price: { type: "integer", minimum: 1 },
                        currency: { type: "string", const: "KRW" },
                        mock: { type: "boolean", const: true },
                        charged: { type: "boolean" },
                      },
                    },
                  ],
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "409": {
            description: "다른 충전에 이미 사용된 요청 키",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/episodes/{id}/candy-unlock": {
      post: {
        tags: ["Candy"],
        summary: "캔디 1개로 유료 회차를 영구 해금합니다.",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["walletToken", "requestKey"],
                properties: {
                  walletToken: { type: "string", format: "uuid" },
                  requestKey: { type: "string", format: "uuid" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "해금 결과와 남은 캔디",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/CandyWallet" },
                    {
                      type: "object",
                      required: ["episodeId", "spent"],
                      properties: {
                        episodeId: { type: "string" },
                        spent: { type: "boolean" },
                      },
                    },
                  ],
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "404": { $ref: "#/components/responses/NotFound" },
          "409": {
            description: "캔디 잔액 부족",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
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
        summary: "공용 데모 주문 요약을 커서 페이지로 조회합니다.",
        parameters: [
          {
            name: "cursor",
            in: "query",
            schema: { type: "string" },
          },
          {
            name: "limit",
            in: "query",
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 50,
              default: 20,
            },
          },
        ],
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
                    required: [
                      "requestKey",
                      "candyWalletToken",
                      "ordererName",
                    ],
                    properties: {
                      requestKey: { type: "string", format: "uuid" },
                      candyWalletToken: {
                        type: "string",
                        format: "uuid",
                      },
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
            description:
              "생성된 주문과 해당 권을 읽을 때 사용하는 entitlementToken",
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
        security: [{ operationsApiKey: [] }, {}],
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
    "/api/orders/{id}/events": {
      get: {
        tags: ["Orders"],
        summary: "주문 상태와 타임라인 변경을 SSE로 구독합니다.",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: {
          "200": {
            description: "order 이벤트로 전달되는 주문 상세 스트림",
            content: {
              "text/event-stream": {
                schema: { type: "string" },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/studio/uploads": {
      post: {
        tags: ["Studio"],
        summary: "ZIP/CBZ를 검증하고 자연 정렬된 미리보기를 만듭니다.",
        security: [{ studioApiKey: [] }, {}],
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
        security: [{ studioApiKey: [] }, {}],
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
                  visibility: {
                    type: "string",
                    enum: ["public", "private"],
                    default: "public",
                    description:
                      "private은 목록·피드에 노출되지 않는 비공개 보관",
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
    "/api/studio/episodes/{episodeId}/visibility": {
      patch: {
        tags: ["Studio"],
        summary: "비공개 보관 에피소드를 공개하거나 다시 비공개로 돌립니다.",
        security: [{ studioApiKey: [] }, {}],
        parameters: [
          {
            name: "episodeId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["visibility"],
                properties: {
                  visibility: {
                    type: "string",
                    enum: ["public", "private"],
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "변경된 에피소드 요약" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/studio/episodes/{episodeId}/title": {
      patch: {
        tags: ["Studio"],
        summary: "등록된 에피소드의 제목을 수정합니다.",
        security: [{ studioApiKey: [] }, {}],
        parameters: [
          {
            name: "episodeId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title"],
                properties: {
                  title: { type: "string", minLength: 1, maxLength: 80 },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "수정된 에피소드 요약" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/studio/episodes/{episodeId}/pages": {
      patch: {
        tags: ["Studio"],
        summary:
          "새 업로드 세션의 원고로 기존 에피소드의 페이지 전체를 교체합니다.",
        security: [{ studioApiKey: [] }, {}],
        parameters: [
          {
            name: "episodeId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["sessionId", "pageIds"],
                properties: {
                  sessionId: { type: "string", format: "uuid" },
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
          "200": { description: "교체된 에피소드 요약" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/studio/drafts": {
      get: {
        tags: ["Studio"],
        summary: "비공개 보관 중인 에피소드 목록을 조회합니다.",
        responses: {
          "200": { description: "비공개 에피소드 목록" },
        },
      },
    },
    "/api/studio/packaging-requests": {
      get: {
        tags: ["Studio"],
        summary: "책 패키징 서비스 신청 내역을 조회합니다.",
        responses: {
          "200": { description: "최근 패키징 신청 목록" },
        },
      },
      post: {
        tags: ["Studio"],
        summary: "업로드한 원고 묶음으로 책 패키징 서비스를 신청합니다.",
        security: [{ studioApiKey: [] }, {}],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: [
                  "sessionId",
                  "pageIds",
                  "applicantName",
                  "bookTitle",
                  "bookSize",
                  "coverType",
                  "quantity",
                ],
                properties: {
                  sessionId: { type: "string", format: "uuid" },
                  pageIds: {
                    type: "array",
                    items: { type: "string", format: "uuid" },
                  },
                  applicantName: { type: "string" },
                  bookTitle: { type: "string" },
                  bookSize: { type: "string", enum: ["A5", "B5"] },
                  coverType: {
                    type: "string",
                    enum: ["softcover", "hardcover"],
                  },
                  quantity: { type: "integer", minimum: 1, maximum: 500 },
                  memo: { type: "string", nullable: true },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "접수된 패키징 신청" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/studio/series": {
      post: {
        tags: ["Studio"],
        summary: "새 작품과 첫 연재 시즌을 만듭니다.",
        security: [{ studioApiKey: [] }, {}],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: [
                  "slug",
                  "title",
                  "synopsis",
                  "genre",
                  "weekday",
                  "authorName",
                ],
                properties: {
                  slug: {
                    type: "string",
                    pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
                  },
                  title: { type: "string", maxLength: 80 },
                  synopsis: { type: "string", maxLength: 1000 },
                  genre: { type: "string", maxLength: 40 },
                  weekday: {
                    type: "string",
                    enum: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
                  },
                  authorName: { type: "string", maxLength: 40 },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "만들어진 작품과 시즌 1" },
          "409": { description: "slug 중복" },
        },
      },
    },
    "/api/studio/episodes/{episodeId}": {
      delete: {
        tags: ["Studio"],
        summary: "에피소드와 발행 원고 파일을 삭제합니다.",
        security: [{ studioApiKey: [] }, {}],
        parameters: [
          {
            name: "episodeId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "204": { description: "삭제 완료" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/studio/series/{seriesId}": {
      patch: {
        tags: ["Studio"],
        summary:
          "작품의 표시 정보(제목, 줄거리)를 부분 수정합니다. slug는 바뀌지 않습니다.",
        security: [{ studioApiKey: [] }, {}],
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
              schema: {
                type: "object",
                minProperties: 1,
                properties: {
                  title: { type: "string", minLength: 1, maxLength: 80 },
                  synopsis: {
                    type: "string",
                    minLength: 1,
                    maxLength: 1000,
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "수정된 작품 정보" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/studio/series/{seriesId}/access-policy": {
      patch: {
        tags: ["Studio"],
        summary: "작품별 무료 권·추가 미리보기 화 수를 변경합니다.",
        security: [{ studioApiKey: [] }, {}],
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
        description:
          "Mock 주문 생성 응답에서 브라우저가 보관하는 entitlementToken",
      },
      studioApiKey: {
        type: "apiKey",
        in: "header",
        name: "x-sweettoon-studio-key",
        description: "API_SECURITY_MODE=strict일 때 필요한 작가 도구 접근 키",
      },
      operationsApiKey: {
        type: "apiKey",
        in: "header",
        name: "x-sweettoon-operations-key",
        description: "API_SECURITY_MODE=strict일 때 필요한 운영 도구 접근 키",
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
      CandyWallet: {
        type: "object",
        required: ["balance", "unitPrice"],
        properties: {
          balance: { type: "integer", minimum: 0 },
          unitPrice: { type: "integer", const: 100 },
        },
      },
      DemoBotStatus: {
        type: "object",
        required: [
          "available",
          "running",
          "leader",
          "readerCount",
          "activeBotCount",
          "speed",
          "tickIntervalSeconds",
        ],
        properties: {
          available: { type: "boolean" },
          running: { type: "boolean" },
          leader: { type: "boolean" },
          readerCount: { type: "integer", minimum: 0, maximum: 30 },
          activeBotCount: { type: "integer", minimum: 0, maximum: 31 },
          speed: {
            type: "string",
            enum: ["slow", "normal", "fast"],
          },
          tickIntervalSeconds: { type: "integer", minimum: 1 },
          lastTickAt: { type: ["string", "null"], format: "date-time" },
          nextTickAt: { type: ["string", "null"], format: "date-time" },
          activeOrderId: { type: ["string", "null"] },
          lastAction: { type: ["string", "null"] },
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
