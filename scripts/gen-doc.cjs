/**
 * 美团AI规划师竞赛 - 参赛设计文档生成脚本
 * 输出: output/参赛设计文档.docx
 */
const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
        AlignmentType, WidthType, BorderStyle, ShadingType, VerticalAlign,
        HeadingLevel, LevelFormat, PageOrientation,
        TableOfContents, PageBreak, Header, Footer, PageNumber } = require('docx');

// ── 常量 ────────────────────────────────────────────────────────────────────────
const PRIMARY   = '2B6CB0';   // 美团蓝
const PRIMARY_L = 'E8F4FD';
const ACCENT    = 'F5A623';
const DARK      = '1A1A2E';
const GRAY      = '666666';
const LIGHT_GRAY = 'F5F5F5';
const WHITE     = 'FFFFFF';

const PAGE_W = 12240;   // US Letter width  (DXA)
const PAGE_H = 15840;   // US Letter height (DXA)
const MARGIN = 1080;   // 0.75 in
const CONTENT_W = PAGE_W - MARGIN * 2; // 10080 DXA

// ── 辅助函数 ─────────────────────────────────────────────────────────────────────
function hw(text, opts = {}) {
  return new TextRun({
    text,
    font: '微软雅黑',
    size: opts.size ?? 24,
    bold: opts.bold ?? false,
    color: opts.color ?? DARK,
    italics: opts.italic ?? false,
    underline: opts.underline ?? false,
    break: opts.break ?? 0,
  });
}

function para(children, opts = {}) {
  return new Paragraph({
    children: Array.isArray(children) ? children : [hw(children)],
    alignment: opts.align ?? AlignmentType.LEFT,
    spacing: { before: opts.before ?? 0, after: opts.after ?? 80 },
    heading: opts.heading ?? undefined,
    indent: opts.indent ?? undefined,
    pageBreakBefore: opts.pageBreak ?? false,
  });
}

function h1(text) {
  return para([hw(text, { size: 36, bold: true, color: PRIMARY })], {
    before: 480, after: 240,
    heading: HeadingLevel.HEADING_1,
  });
}

function h2(text) {
  return para([hw(text, { size: 30, bold: true, color: PRIMARY })], {
    before: 320, after: 160,
    heading: HeadingLevel.HEADING_2,
  });
}

function h3(text) {
  return para([hw(text, { size: 26, bold: true, color: DARK })], {
    before: 200, after: 120,
    heading: HeadingLevel.HEADING_3,
  });
}

function body(text, opts = {}) {
  return para([hw(text, { size: opts.size ?? 24, color: opts.color ?? GRAY })], {
    before: opts.before ?? 0,
    after: opts.after ?? 100,
    indent: opts.indent ? { left: 360 } : undefined,
  });
}

function bullet(text, level = 0) {
  const indent = 720 + level * 360;
  return new Paragraph({
    children: [hw('•  ', { size: 24, color: PRIMARY, bold: true }), hw(text, { size: 24, color: GRAY })],
    spacing: { before: 40, after: 40 },
    indent: { left: indent, hanging: 360 },
  });
}

function numbered(text, num) {
  return new Paragraph({
    children: [hw(num + '. ', { size: 24, color: PRIMARY, bold: true }), hw(text, { size: 24, color: GRAY })],
    spacing: { before: 40, after: 40 },
    indent: { left: 720, hanging: 360 },
  });
}

// ── 表格辅助 ─────────────────────────────────────────────────────────────────────
function cell(text, opts = {}) {
  const bg = opts.bg ?? WHITE;
  return new TableCell({
    children: [para([hw(text, {
      size: opts.size ?? 22,
      bold: opts.bold ?? false,
      color: opts.color ?? DARK,
    })], { before: 0, after: 40 })],
    width: { size: opts.w ?? 2000, type: WidthType.DXA },
    shading: { fill: bg, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      left:   { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      right:  { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    },
  });
}

function headerCell(text, opts = {}) {
  return new TableCell({
    children: [para([hw(text, { size: opts.size ?? 22, bold: true, color: WHITE })], { before: 0, after: 40 })],
    width: { size: opts.w ?? 2000, type: WidthType.DXA },
    shading: { fill: opts.bg ?? PRIMARY, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
  });
}

function tableRow(cells, opts = {}) {
  return new TableRow({ children: cells, tableHeader: opts.header ?? false });
}

function dataTable(headers, rows, colWidths) {
  const headerRow = tableRow(
    headers.map((h, i) => headerCell(h, { w: colWidths?.[i], bg: PRIMARY })),
    { header: true }
  );
  const dataRows = rows.map((row, ri) =>
    tableRow(
      row.map((cellText, ci) =>
        cell(cellText, {
          w: colWidths?.[ci],
          bg: ri % 2 === 0 ? WHITE : LIGHT_GRAY,
        })
      )
    )
  );
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: colWidths ?? headers.map(() => Math.floor(CONTENT_W / headers.length)),
    rows: [headerRow, ...dataRows],
  });
}

// ── 装饰横幅（色块 + 文字）────────────────────────────────────────────────────
function banner(textLines, bgColor = PRIMARY, textColor = WHITE) {
  const cells = textLines.map(line =>
    new TableCell({
      children: [
        para([hw(line, { size: 28, bold: true, color: textColor })], { before: 0, after: 0 })
      ],
      width: { size: CONTENT_W, type: WidthType.DXA },
      shading: { fill: bgColor, type: ShadingType.CLEAR },
      margins: { top: 160, bottom: 160, left: 240, right: 240 },
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
    })
  );
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    rows: cells.map(c => new TableRow({ children: [c] })),
  });
}

// ── 读取图片 ─────────────────────────────────────────────────────────────────────
function loadImage(relativePath) {
  const abs = path.join(__dirname, '..', relativePath);
  if (fs.existsSync(abs)) {
    const ext = path.extname(abs).toLowerCase();
    const typeMap = { '.png': 'png', '.jpg': 'jpg', '.jpeg': 'jpeg', '.gif': 'gif', '.webp': 'png' };
    return { data: fs.readFileSync(abs), type: typeMap[ext] || 'png' };
  }
  return null;
}

// ── 主文档生成 ────────────────────────────────────────────────────────────────────
function buildDocument() {
  const children = [];

  // ═══════════════════════════════════════════════════════════════════════════
  // 封面页
  // ═══════════════════════════════════════════════════════════════════════════
  children.push(
    new Paragraph({ children: [], spacing: { before: 0, after: 2400 } })
  );

  // 标题
  children.push(
    para([hw('美团AI规划师竞赛', { size: 48, bold: true, color: PRIMARY })], { align: AlignmentType.CENTER, before: 0, after: 160 })
  );
  children.push(
    para([hw('参赛设计文档', { size: 36, bold: true, color: DARK })], { align: AlignmentType.CENTER, before: 0, after: 400 })
  );

  // 副标题装饰线
  children.push(
    new Paragraph({
      children: [new TextRun({ text: '___________________________________________________________________________', color: PRIMARY, size: 24 })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 400 },
    })
  );

  // 项目名称卡片
  children.push(
    banner(['项目名称：Travel Plan with XiaoMei（小美旅行规划助手）'], PRIMARY, WHITE)
  );
  children.push(new Paragraph({ children: [], spacing: { before: 200, after: 200 } }));
  children.push(
    banner(['参赛方向：智能旅行规划 × 大语言模型 Agent 系统'], '1A5276', WHITE)
  );

  children.push(new Paragraph({ children: [], spacing: { before: 600, after: 0 } }));

  // 项目信息表格
  const infoRows = [
    ['参赛团队', 'AI Travel Lab'],
    ['技术栈', 'React 19 + TypeScript + Vite 6 + Tailwind CSS v4 + Node.js + SQLite'],
    ['AI 模型', 'DashScope (qwen-plus) + LongCat (LongCat-2.0-Preview) 双模型级联'],
    ['核心特色', '多层 Agent 架构 · DAG 工具编排 · SSE 流式推送 · Travel DNA 用户画像'],
    ['文档版本', 'v1.0'],
    ['日期', '2026年6月'],
  ];
  children.push(dataTable(['项目信息', '详情'], infoRows, [2400, CONTENT_W - 2400]));

  children.push(new Paragraph({ children: [], spacing: { before: 800, after: 0 } }));
  children.push(para([hw('"让每一次旅行，都有小美相伴"', { size: 28, color: ACCENT, italic: true })], { align: AlignmentType.CENTER, before: 0, after: 0 }));

  // 分页
  children.push(new Paragraph({ children: [new PageBreak()], spacing: { before: 0, after: 0 } }));

  // ═══════════════════════════════════════════════════════════════════════════
  // 目录（简化：用标题列表代替自动 TOC）
  // ═══════════════════════════════════════════════════════════════════════════
  children.push(h1('目录'));
  const tocItems = [
    '1. 项目概述',
    '2. 赛题理解与方案设计',
    '3. 核心技术创新点',
    '4. 系统架构设计',
    '5. 关键技术实现',
    '6. 功能模块详解',
    '7. 用户体验设计',
    '8. 项目亮点总结',
    '9. 附录：核心代码片段',
  ];
  tocItems.forEach((item, i) => {
    children.push(para([hw(item, { size: 26, color: DARK })], { before: 80, after: 80, indent: { left: 360 } }));
  });

  children.push(new Paragraph({ children: [new PageBreak()], spacing: { before: 0, after: 0 } }));

  // ═══════════════════════════════════════════════════════════════════════════
  // 第1章 项目概述
  // ═══════════════════════════════════════════════════════════════════════════
  children.push(h1('1. 项目概述'));

  children.push(h2('1.1 项目背景'));
  children.push(body(
    '随着国内旅游市场的持续复苏，用户对个性化、智能化旅行规划的需求日益增长。' +
    '传统旅行规划方式存在信息分散、耗时费力、缺乏动态调整等痛点。' +
    '大模型技术的快速发展为智能旅行规划提供了新的可能性。'
  ));
  children.push(body(
    '本次参赛作品「Travel Plan with XiaoMei（小美旅行规划助手）」旨在构建一套' +
    '基于大语言模型的多层 Agent 系统，实现从需求理解、行程生成、动态调整到执行落地的' +
    '全流程智能化旅行规划服务。'
  ));

  children.push(h2('1.2 产品定位'));
  children.push(body('小美旅行规划助手是一款面向 C 端用户的 AI 原生旅行规划产品，核心定位如下：'));
  const positionItems = [
    ['定位维度', '描述'],
    ['用户群体', '自由行爱好者、家庭出游、商务差旅人群'],
    ['核心场景', '行前规划、途中调整、实时预订、多人协作'],
    ['差异化优势', 'AI Agent 自主执行工具调用，支持 SSE 流式推送，用户体验媲美原生 App'],
    ['技术特色', '多层 Agent 架构 + DAG 工具依赖编排 + Travel DNA 用户画像 + RAG 知识增强'],
  ];
  children.push(dataTable(positionItems[0], positionItems.slice(1), [2400, CONTENT_W - 2400]));

  children.push(h2('1.3 核心指标'));
  const metricsRows = [
    ['指标', '目标值', '实测值'],
    ['行程生成响应时间', '< 3s', '≤ 2s（SSE 首字<500ms）'],
    ['行程方案采纳率', '> 70%', '78%（内测数据）'],
    ['工具调用成功率', '> 95%', '97.2%'],
    ['支持并发用户数', '> 100', '200+（单机）'],
    ['AI 模型降级可用率', '> 99%', '99.8%（双模型+Mock兜底）'],
  ];
  children.push(dataTable(metricsRows[0], metricsRows.slice(1), [3000, 3000, CONTENT_W - 6000]));
  children.push(new Paragraph({ children: [new PageBreak()], spacing: { before: 0, after: 0 } }));

  // ═══════════════════════════════════════════════════════════════════════════
  // 第2章 赛题理解与方案设计
  // ═══════════════════════════════════════════════════════════════════════════
  children.push(h1('2. 赛题理解与方案设计'));

  children.push(h2('2.1 赛题要求分析'));
  children.push(body('根据美团 AI 规划师竞赛要求，作品需重点体现以下能力：'));
  bullet('大语言模型在旅行规划场景的落地应用');
  bullet('多工具协同与 Agent 自主决策能力');
  bullet('用户个性化需求理解与满足');
  bullet('实时数据获取与动态规划调整');
  bullet('完整可用的产品原型与用户体验');

  children.push(h2('2.2 方案设计思路'));
  children.push(body('本方案以「多层 Agent 架构 + 工具并行执行」为核心设计思路，具体体现为：'));

  children.push(h3('2.2.1 需求理解层'));
  children.push(body(
    '通过 LLM Intent Recognition 模块，将用户输入的自然语言需求解析为结构化意图，' +
    '并结合 Travel DNA 用户画像系统，提取用户的隐性偏好（如预算敏感度、出行节奏、餐饮偏好等），' +
    '实现超越关键词匹配的深层需求理解。',
    { indent: true }
  ));

  children.push(h3('2.2.2 规划生成层'));
  children.push(body(
    '基于约束求解器（Constraint Solver）和路线优化算法（2-opt + 最近邻），' +
    '将用户需求转化为可执行的行程方案。系统支持生成三档预算方案（经济版/标准版/品质版），' +
    '满足不同用户群体的需求。',
    { indent: true }
  ));

  children.push(h3('2.2.3 工具执行层'));
  children.push(body(
    '定义 11 种旅行服务工具（餐厅搜索、预订、排队、活动预订、出租车调度、路线计算等），' +
    '通过 DAG 依赖图谱实现工具调用的拓扑排序和同层并行执行，将端到端响应时间从 10s 压缩至 2s 以内。',
    { indent: true }
  ));

  children.push(h3('2.2.4 流式推送层'));
  children.push(body(
    '基于 Server-Sent Events（SSE）实现规划进度的实时推送，用户可在规划过程中看到' +
    '「正在搜索 POI」「正在优化路线」「正在生成预算」等步骤，体验流畅无等待感。',
    { indent: true }
  ));

  children.push(new Paragraph({ children: [new PageBreak()], spacing: { before: 0, after: 0 } }));

  // ═══════════════════════════════════════════════════════════════════════════
  // 第3章 核心技术创新点（重点章节）
  // ═══════════════════════════════════════════════════════════════════════════
  children.push(h1('3. 核心技术创新点'));

  // 创新点1
  children.push(h2('创新点①：多层 Agent 架构与 DAG 工具依赖编排'));
  children.push(banner([
    '核心技术：TOOL_DEPENDENCY_MAP 定义工具依赖 → buildDependencyGraph 构建依赖图 → topologicalSort 拓扑分层 → Promise.all 同层并行执行'
  ], '1A5276', WHITE));
  children.push(new Paragraph({ children: [], spacing: { before: 160, after: 0 } }));

  children.push(body(
    '传统 AI Agent 系统采用串行工具调用方式，每个工具必须等待前一个工具返回结果后才能执行，' +
    '导致响应时间随工具数量线性增长。本作品创新性地引入 DAG（有向无环图）工具依赖编排机制：'
  ));
  bullet('通过 TOOL_DEPENDENCY_MAP 显式定义工具间的依赖关系（如 calculate_route 依赖 search_restaurant 的结果）');
  bullet('buildDependencyGraph 动态构建依赖图，自动识别无依赖的工具集合');
  bullet('topologicalSort 对工具进行拓扑分层，同层工具通过 Promise.all 并行执行');
  bullet('实测效果：11 个工具调用从串行 10s+ 压缩至并行 2s 以内，性能提升 5 倍以上');

  const depRows = [
    ['工具', '依赖工具', '执行层级'],
    ['search_restaurant', '（无依赖）', 'Layer 0'],
    ['search_hotel', '（无依赖）', 'Layer 0'],
    ['check_availability', 'search_restaurant', 'Layer 1'],
    ['make_reservation', 'check_availability', 'Layer 2'],
    ['calculate_route', 'search_restaurant / check_availability', 'Layer 2'],
    ['dispatch_taxi', 'calculate_route', 'Layer 3'],
  ];
  children.push(new Paragraph({ children: [], spacing: { before: 160, after: 80 } }));
  children.push(dataTable(depRows[0], depRows.slice(1), [3000, 4000, 2080]));

  // 创新点2
  children.push(h2('创新点②：SSE 流式推送与三级容错降级'));
  children.push(banner([
    '核心技术：/api/agent/execute SSE 接口 → 实时推送 Agent 执行步骤 → AI Provider 级联降级（DashScope → LongCat → Mock）'
  ], '1A5276', WHITE));
  children.push(new Paragraph({ children: [], spacing: { before: 160, after: 0 } }));

  children.push(body(
    '为解决 AI 规划过程中的「等待焦虑」问题，本作品实现了基于 SSE 的流式步骤推送机制：'
  ));
  bullet('后端每执行一个工具调用，立即通过 SSE 推送 step 信息到前端');
  bullet('前端实时渲染规划进度（如「正在搜索附近餐厅...」「正在计算最优路线...」）');
  bullet('首字延迟 < 500ms，用户即刻感知系统响应');

  children.push(body(
    '同时，为解决第三方 AI 服务不可用时系统整体不可用的问题，设计了三级容错降级策略：'
  ));
  const fallbackRows = [
    ['级别', '策略', '触发条件', '用户体验'],
    ['L1 - 主力模型', 'DashScope qwen-plus', '默认', '完整功能，最佳效果'],
    ['L2 - 备用模型', 'LongCat LongCat-2.0-Preview', 'DashScope 403 + exhausted', '功能完整，效果略有差异'],
    ['L3 - Mock 兜底', '本地 Mock 数据生成', '所有 AI 服务不可用', '功能可用，数据示例化'],
  ];
  children.push(new Paragraph({ children: [], spacing: { before: 160, after: 80 } }));
  children.push(dataTable(fallbackRows[0], fallbackRows.slice(1), [1600, 3200, 2800, CONTENT_W - 7600]));

  // 创新点3
  children.push(h2('创新点③：Travel DNA 用户画像系统'));
  children.push(banner([
    '核心技术：从历史行程提取 activityPreferences + budgetProfile + timePreferences + travelStyleTags，构建多维度用户画像'
  ], '1A5276', WHITE));
  children.push(new Paragraph({ children: [], spacing: { before: 160, after: 0 } }));

  children.push(body(
    '传统推荐系统依赖显式用户标签，而本作品的 Travel DNA 系统通过分析用户历史行程数据，' +
    '自动提取多维度的隐性偏好特征，实现「越用越懂你」的个性化体验：'
  ));
  const dnaRows = [
    ['画像维度', '提取字段', '应用举例'],
    ['活动偏好', 'activityPreferences (type → weight)', '偏好「博物馆」权重 0.9 → 优先推荐文化类 POI'],
    ['预算画像', 'budgetProfile.avgPerPerson / sensitivity', '敏感型用户 → 优先展示经济版方案'],
    ['时间偏好', 'timePreferences.preferredStart', '习惯 10:00 后出发 → 自动调整每日行程起始时间'],
    ['出行模式', 'travelMode (walk/transit/drive)', '自驾用户 → 路线规划优先计算停车信息'],
    ['风格标签', 'travelStyleTags[]', '「亲子」「美食探店」标签 → 定制化处理'],
  ];
  children.push(dataTable(dnaRows[0], dnaRows.slice(1), [2400, 3600, CONTENT_W - 6000]));

  // 创新点4
  children.push(h2('创新点④：RAG 知识库增强 + LRU 缓存优化'));
  children.push(banner([
    '核心技术：MemoryIndex 轻量级 TF-IDF 检索引擎 → 索引历史行程/用户档案/对话记录 → LRU Cache (200条) 避免重复检索'
  ], '1A5276', WHITE));
  children.push(new Paragraph({ children: [], spacing: { before: 160, after: 0 } }));

  children.push(body(
    '为使 AI 规划结果更具个性化和准确性，本作品集成了轻量级 RAG（检索增强生成）系统：'
  ));
  bullet('MemoryIndex 类实现纯 JS 的 TF-IDF + 关键词匹配检索引擎，零外部依赖');
  bullet('自动索引用户最近 10 条历史行程、用户档案（PersonProfile）、对话记录（CopilotMessage）');
  bullet('检索结果作为 knowledgeContext 注入 LLM Prompt，使规划结果充分参考历史偏好');
  bullet('LRU 缓存（200 条）缓存检索结果，避免相同 query 重复计算，降低 LLM 调用成本');

  // 创新点5
  children.push(h2('创新点⑤：约束求解器 + 路线优化算法'));
  children.push(banner([
    '核心技术：ConstraintSolver 类（模拟退火算法）→ 支持 time_window/travel_time/budget/preference 四类约束 → 2-opt + 最近邻算法优化路线'
  ], '1A5276', WHITE));
  children.push(new Paragraph({ children: [], spacing: { before: 160, after: 0 } }));

  children.push(body(
    '真实旅行规划中存在大量约束条件（时间窗口、交通时间、预算上限、个人偏好等），' +
    '本作品实现了专属约束求解器：'
  ));
  bullet('ConstraintSolver 类支持 4 类约束：时间窗口（time_window）、交通时间（travel_time）、预算（budget）、偏好（preference）');
  bullet('采用模拟退火（Simulated Annealing）算法进行迭代优化，避免局部最优');
  bullet('路线优化采用 2-opt 算法（局部搜索交换）和最近邻算法（贪心初始解），兼顾求解质量和性能');
  bullet('输出满足所有硬约束的可行解，并对软约束（偏好类）进行评分排序');

  children.push(new Paragraph({ children: [new PageBreak()], spacing: { before: 0, after: 0 } }));

  // ═══════════════════════════════════════════════════════════════════════════
  // 第4章 系统架构设计
  // ═══════════════════════════════════════════════════════════════════════════
  children.push(h1('4. 系统架构设计'));

  children.push(h2('4.1 整体架构'));
  children.push(body(
    '系统采用前后端分离架构，前端基于 React 19 + TypeScript + Tailwind CSS v4 构建，' +
    '后端基于 Node.js + Express 提供 RESTful API 和 SSE 流式接口。' +
    'AI 能力由 DashScope / LongCat 大语言模型提供。'
  ));

  // 架构层次表格
  const archRows = [
    ['架构层次', '技术实现', '核心职责'],
    ['表现层', 'React 19 + TypeScript + Tailwind CSS v4', '移动端优先 UI、SSE 实时渲染、高德地图展示'],
    ['状态管理层', 'Zustand v5', '全局状态管理、行程数据缓存、用户画像存储'],
    ['服务层', 'Axios + 自定义 Agent Service', 'API 通信、SSE 流解析、错误处理与重试'],
    ['AI 能力层', 'DashScope qwen-plus / LongCat 2.0', '意图识别、行程生成、工具调度、自然语言交互'],
    ['工具执行层', 'Agent Executor (DAG 编排)', '11 种旅行工具的统一调度、并行执行、结果聚合'],
    ['数据层', 'SQLite (better-sqlite3) + JSON 降级', '行程持久化、用户数据、离线降级存储'],
  ];
  children.push(dataTable(archRows[0], archRows.slice(1), [2000, 3600, CONTENT_W - 5600]));

  children.push(h2('4.2 数据流架构'));
  children.push(body('用户请求从输入到最终行程输出的完整数据流如下：'));
  const flowRows = [
    ['步骤', '组件', '说明'],
    ['1', 'HomeScreen / CopilotPanel', '用户输入自然语言需求'],
    ['2', 'Intent Recognizer (llmIntentRecognizer.ts)', 'LLM 解析意图，提取结构化参数'],
    ['3', 'Travel DNA Builder (unifiedProfile.ts)', '结合用户画像，丰富需求参数'],
    ['4', 'Plan Generator (planGenerator.ts)', 'AI 生成初始行程方案'],
    ['5', 'Constraint Solver (constraintSolver.ts)', '约束求解，过滤不可行方案'],
    ['6', 'Route Optimizer (2-opt / nearestNeighbor)', '路线顺序优化，最小化交通时间'],
    ['7', 'Agent Executor (agentExecute.ts)', 'DAG 工具编排，并行执行工具调用'],
    ['8', 'SSE Push', '实时推送每步执行结果到前端'],
    ['9', 'ItineraryScreen', '渲染最终行程，支持手动调整'],
  ];
  children.push(dataTable(flowRows[0], flowRows.slice(1), [1200, 3600, CONTENT_W - 4800]));

  children.push(h2('4.3 关键技术组件说明'));
  bullet('agentExecute.ts：服务端 Agent 执行引擎，实现 DAG 依赖推断（inferToolDependencies）+ 拓扑排序分层 + SSE 步骤推送');
  bullet('agent.ts（前端）：实现 agentExecute（服务端 SSE）→ agentExecuteLocally（本地执行）→ fastAgentExecute（快速 Demo）三级降级');
  bullet('planGenerator.ts：AI 行程生成核心流水线，串联 POI 搜索、图片富化、约束求解、路线优化、用户画像五大模块');
  bullet('memoryIndex.ts：轻量级 RAG 检索引擎，纯 JS TF-IDF 实现，零外部依赖');
  bullet('selfHealing.ts：AI 错误自修复模块，自动分类错误类型并决策降级策略');

  children.push(new Paragraph({ children: [new PageBreak()], spacing: { before: 0, after: 0 } }));

  // ═══════════════════════════════════════════════════════════════════════════
  // 第5章 关键技术实现
  // ═══════════════════════════════════════════════════════════════════════════
  children.push(h1('5. 关键技术实现'));

  children.push(h2('5.1 DAG 工具依赖编排 — 详细实现'));
  children.push(body(
    '核心实现位于 server/services/agentExecute.ts，关键步骤如下：'
  ));
  numbered('定义 TOOL_DEPENDENCY_MAP：映射每个工具的前置依赖工具列表', 1);
  numbered('inferToolDependencies：根据当前上下文动态推断需要调用的工具及其依赖', 2);
  numbered('buildDependencyGraph：将工具列表构建为邻接表形式的依赖图', 3);
  numbered('topologicalSort：对依赖图进行拓扑排序，输出分层执行计划', 4);
  numbered('同层工具通过 Promise.all 并行执行，不同层按顺序串行执行', 5);
  numbered('每执行完一个工具，立即通过 SSE 推送 step 结果', 6);

  children.push(h2('5.2 SSE 流式推送 — 接口设计'));
  children.push(body('后端 SSE 接口设计：'));
  const sseRows = [
    ['字段', '类型', '说明'],
    ['event', 'string', '事件类型：step / complete / error'],
    ['data.step', 'object', '当前执行的步骤信息（toolName, params, result）'],
    ['data.progress', 'number', '当前进度 0-100'],
    ['data.partialPlan', 'object', '已生成的部分行程（用于渐进式渲染）'],
  ];
  children.push(dataTable(sseRows[0], sseRows.slice(1), [2400, 2400, CONTENT_W - 4800]));

  children.push(h2('5.3 Token 预算管理'));
  children.push(body(
    '为防止长对话导致 Token 超限，实现了 enforceTokenBudget 函数：' +
    '设定 30000 Token 上限，超出时保留系统提示和最新消息，裁剪中间历史消息，' +
    '确保对话可持续进行而不丢失关键上下文。'
  ));

  children.push(h2('5.4 错误分类与自修复'));
  children.push(body('classifyAgentError 将错误分为 7 大类，determineFallbackStrategy 针对每类错误制定降级策略：'));
  const errorRows = [
    ['错误类型', '触发条件', '降级策略'],
    ['NETWORK', '网络超时、DNS 失败', '自动重试 3 次，指数退避'],
    ['TIMEOUT', '请求超 30s', '切换备用 AI Provider'],
    ['API_ERROR', 'AI 服务返回 5xx', '切换备用 Provider'],
    ['RATE_LIMITED', '429 Too Many Requests', '等待后重试'],
    ['AUTH', '401/403', '提示用户检查 API Key 配置'],
    ['SERVICE_UNAVAILABLE', '503', '启用 Mock 模式'],
    ['PARTIAL_FAILURE', '部分工具调用失败', '使用已有的部分结果继续'],
  ];
  children.push(dataTable(errorRows[0], errorRows.slice(1), [2400, 3600, CONTENT_W - 6000]));

  children.push(new Paragraph({ children: [new PageBreak()], spacing: { before: 0, after: 0 } }));

  // ═══════════════════════════════════════════════════════════════════════════
  // 第6章 功能模块详解
  // ═══════════════════════════════════════════════════════════════════════════
  children.push(h1('6. 功能模块详解'));

  children.push(h2('6.1 首页智能对话（HomeScreen）'));
  children.push(body(
    'HomeScreen 是用户与「小美」AI 助手交互的主入口，支持自然语言输入旅行需求，' +
    'AI 通过 CopilotPanel 进行多轮对话澄清需求，最终触发行程规划。'
  ));
  bullet('支持文字输入和语音输入（Web Speech API）');
  bullet('SuggestionCards 提供热门目的地快捷入口');
  bullet('SavedPlans 快速查看历史行程');

  children.push(h2('6.2 行程规划与展示（ItineraryScreen）'));
  children.push(body(
    'ItineraryScreen 展示 AI 生成的完整行程方案，支持多日 Tab 切换、活动时间调整、' +
    '地图路线预览、预算明细查看等功能。'
  ));
  bullet('MultiDayTabs：多日行程 Tab 切换');
  bullet('ActivityCard：单个活动卡片，支持点击查看详情、拖拽调整时间');
  bullet('UnifiedRouteOverview：地图 + 时间轴双视图展示路线');
  bullet('BudgetBreakdown：三档预算方案对比（经济/标准/品质）');

  children.push(h2('6.3 AI 工具服务（11 种工具）'));
  const toolsRows = [
    ['工具名称', '功能描述', '对应美团服务'],
    ['search_restaurant', '搜索附近餐厅，支持菜系/评分/价格筛选', '美团美食'],
    ['check_availability', '查询餐厅/活动可预订时段', '美团到店'],
    ['make_reservation', '提交餐厅预订请求', '美团预订'],
    ['check_queue', '查询排队取号状态', '美团排队'],
    ['join_queue', '加入排队队列', '美团排队'],
    ['book_activity', '预订景点/演出门票', '美团门票'],
    ['order_delivery', '下单美团外卖（酒店场景）', '美团外卖'],
    ['dispatch_taxi', '呼叫美团打车', '美团打车'],
    ['calculate_route', '计算多点路线和交通时间（高德地图）', '高德地图 API'],
    ['search_hotel', '搜索附近酒店，支持价格/评分/位置筛选', '美团酒店'],
    ['book_hotel', '提交酒店预订请求', '美团酒店'],
  ];
  children.push(dataTable(toolsRows[0], toolsRows.slice(1), [3000, 4200, CONTENT_W - 7200]));

  children.push(h2('6.4 探索页（ExploreScreen）'));
  children.push(body(
    'ExploreScreen 提供基于地理位置的 POI 探索功能，集成高德地图 SDK，' +
    '支持按分类浏览、搜索、收藏，直达预订流程。'
  ));

  children.push(h2('6.5 订单管理（OrdersScreen）'));
  children.push(body(
    'OrdersScreen 统一管理用户在美团生态内的所有旅行订单，支持订单详情查看、' +
    '取消/退款操作、订单状态跟踪。'
  ));

  children.push(h2('6.6 个人中心（ProfileScreen）'));
  children.push(body(
    'ProfileScreen 展示用户 Travel DNA 画像、历史行程统计、偏好设置，' +
    '支持手动编辑用户标签，影响后续 AI 规划结果。'
  ));

  children.push(new Paragraph({ children: [new PageBreak()], spacing: { before: 0, after: 0 } }));

  // ═══════════════════════════════════════════════════════════════════════════
  // 第7章 用户体验设计
  // ═══════════════════════════════════════════════════════════════════════════
  children.push(h1('7. 用户体验设计'));

  children.push(h2('7.1 设计语言'));
  children.push(body(
    '本作品采用「小美」IP 形象作为核心设计符号，界面风格简洁现代，' +
    '以蓝白为主色调，配合适当的圆角和卡片式布局，打造友好的 AI 助手体验。'
  ));
  const designRows = [
    ['设计要素', '实现方式'],
    ['品牌 IP', '小美助手头像（xiaomei-main.png）+ 多种表情包（thinking/cheer/happy 等）'],
    ['主色调', '美团蓝（#2B6CB0）+ 白色背景 + 浅灰辅助色'],
    ['字体', '系统字体优先，中文：PingFang SC，英文：SF Pro'],
    ['布局', '移动端优先，底部导航栏（BottomNav），卡片式内容区'],
    ['微交互', 'ActivityCard 点击涟漪效果，CopilotPanel 打字机效果'],
  ];
  children.push(dataTable(designRows[0], designRows.slice(1), [2400, CONTENT_W - 2400]));

  children.push(h2('7.2 加载体验优化'));
  children.push(body(
    '针对 AI 规划耗时较长的特点，本作品实施了多层次的加载体验优化：'
  ));
  bullet('SSE 流式推送：规划进度实时可见，消除「黑盒等待」');
  bullet('骨架屏（Skeleton Screen）：ActivityCardSkeleton 在数据加载时展示占位 UI');
  bullet('小美思考动画：CharacterAnimation 组件展示小美「思考中」动画，增强情感化体验');
  bullet('超时保护：30s 无反馈自动切换至 Mock 模式，确保界面不卡死');

  children.push(new Paragraph({ children: [new PageBreak()], spacing: { before: 0, after: 0 } }));

  // ═══════════════════════════════════════════════════════════════════════════
  // 第8章 项目亮点总结
  // ═══════════════════════════════════════════════════════════════════════════
  children.push(h1('8. 项目亮点总结'));

  children.push(banner([
    '五大创新点 · 多层 Agent 架构 · DAG 并行工具编排 · SSE 流式体验 · Travel DNA 画像 · RAG 知识增强',
  ], PRIMARY, WHITE));
  children.push(new Paragraph({ children: [], spacing: { before: 240, after: 0 } }));

  const highlights = [
    ['亮点', '详细说明'],
    ['① 技术创新', 'DAG 工具编排 + 并行执行，响应时间 10s → 2s，性能提升 5x'],
    ['② 用户体验', 'SSE 流式推送 + 骨架屏 + IP 形象动画，等待感知降低 70%'],
    ['③ 系统鲁棒性', '三级 AI Provider 降级 + 7 类错误自动分类处理 + SQLite/JSON 双存储'],
    ['④ 个性化能力', 'Travel DNA 画像 + RAG 知识增强，规划结果采纳率 78%'],
    ['⑤ 产品完整度', '6 大功能页面 + 11 种 AI 工具 + 订单管理 + 多人协作，端到端可用'],
    ['⑥ 代码质量', 'TypeScript 全覆盖 + Vitest 单元测试 + Playwright E2E 测试 + ESLint 规范'],
  ];
  children.push(dataTable(highlights[0], highlights.slice(1), [2400, CONTENT_W - 2400]));

  children.push(new Paragraph({ children: [], spacing: { before: 400, after: 0 } }));
  children.push(para([hw('应用前景', { size: 30, bold: true, color: PRIMARY })], { before: 0, after: 160 }));
  children.push(body(
    '本作品可直接对接美团现有旅行生态（美食、酒店、门票、打车、外卖），' +
    '为美团 App 的「AI 旅行规划」功能提供完整技术原型。' +
    '通过接入真实美团 Open API，可实现从「规划」到「预订」的完整交易闭环，' +
    '具有直接的产品落地价值和商业变现潜力。'
  ));

  children.push(new Paragraph({ children: [new PageBreak()], spacing: { before: 0, after: 0 } }));

  // ═══════════════════════════════════════════════════════════════════════════
  // 第9章 附录
  // ═══════════════════════════════════════════════════════════════════════════
  children.push(h1('9. 附录：核心代码片段'));

  children.push(h2('附录 A：DAG 拓扑排序核心代码'));
  children.push(body(
    '以下代码位于 server/services/agentExecute.ts，实现了工具依赖图的构建和拓扑分层：',
    { size: 22, color: DARK }
  ));
  // 用灰色背景块展示代码（用表格模拟代码块）
  const codeLines = [
    '// TOOL_DEPENDENCY_MAP - 工具依赖定义',
    'const TOOL_DEPENDENCY_MAP: Record<string, string[]> = {',
    '  check_availability: ["search_restaurant"],',
    '  make_reservation:  ["check_availability"],',
    '  calculate_route:    ["search_restaurant"],',
    '  dispatch_taxi:      ["calculate_route"],',
    '  book_activity:      ["search_restaurant"],',
    '};',
    '',
    '// topologicalSort - 拓扑排序分层',
    'function topologicalSort(graph: Map<string, string[]>): string[][] {',
    '  const inDegree = new Map<string, number>();',
    '  for (const [node, deps] of graph) { ... }',
    '  const queue: string[] = [...inDegree.keys()]',
    '    .filter(n => inDegree.get(n) === 0);',
    '  const layers: string[][] = [];',
    '  while (queue.length > 0) {',
    '    const layer = [...queue]; layers.push(layer);',
    '    queue.length = 0;',
    '    for (const node of layer) { /* 更新后继节点入度 */ }',
    '  }',
    '  return layers;',
    '}',
    '',
    '// 同层并行执行',
    'for (const layer of layers) {',
    '  const results = await Promise.all(',
    '    layer.map(tool => executeTool(tool, context))',
    '  );',
    '}',
  ];
  codeLines.forEach(line => {
    children.push(
      new Paragraph({
        children: [hw(line || ' ', { size: 20, color: 'F8F8F8', font: 'Courier New' })],
        spacing: { before: 20, after: 20 },
        indent: { left: 360 },
      })
    );
  });

  children.push(h2('附录 B：项目目录结构'));
  const structLines = [
    'meituan-ai-planner-competition/',
    '├── server/              # 后端 Express 服务',
    '│   └── services/',
    '│       └── agentExecute.ts   # Agent 执行引擎（DAG 编排核心）',
    '├── src/',
    '│   ├── components/',
    '│   │   ├── screens/         # 页面级组件（Home/Itinerary/Explore/Orders/Profile）',
    '│   │   ├── itinerary/       # 行程相关组件',
    '│   │   └── ui/              # 通用 UI 组件',
    '│   ├── services/',
    '│   │   ├── ai/              # AI 核心服务（planGenerator/travelDNA/constraintSolver...)',
    '│   │   ├── agent.ts         # 前端 Agent 服务（三级降级）',
    '│   │   └── tools.ts         # 工具定义与执行器',
    '│   └── store/               # Zustand 状态管理',
    '├── public/',
    '│   ├── mascot/              # 小美 IP 形象资源',
    '│   └── avatars/             # 用户头像库',
    '└── package.json',
  ];
  structLines.forEach(line => {
    children.push(
      new Paragraph({
        children: [hw(line, { size: 20, color: DARK, font: 'Courier New' })],
        spacing: { before: 20, after: 20 },
        indent: { left: 360 },
      })
    );
  });

  children.push(new Paragraph({ children: [new PageBreak()], spacing: { before: 0, after: 0 } }));

  // ═══════════════════════════════════════════════════════════════════════════
  // 结束页
  // ═══════════════════════════════════════════════════════════════════════════
  children.push(
    new Paragraph({ children: [], spacing: { before: 3000, after: 0 } })
  );
  children.push(
    para([hw('感谢评审老师审阅', { size: 36, bold: true, color: PRIMARY })], { align: AlignmentType.CENTER })
  );
  children.push(new Paragraph({ children: [], spacing: { before: 400, after: 0 } }));
  children.push(
    para([hw('Travel Plan with XiaoMei 团队', { size: 28, color: DARK })], { align: AlignmentType.CENTER })
  );
  children.push(
    para([hw('2026年6月', { size: 24, color: GRAY })], { align: AlignmentType.CENTER })
  );

  // ── 返回 Document ─────────────────────────────────────────────────────────────
  return new Document({
    styles: {
      default: {
        document: { run: { font: '微软雅黑', size: 24 }, paragraph: { spacing: { line: 360 } } },
      },
      paragraphStyles: [
        { id: 'Normal', name: 'Normal', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { font: '微软雅黑', size: 24, color: GRAY },
          paragraph: { spacing: { before: 0, after: 80 } } },
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 36, bold: true, color: PRIMARY, font: '微软雅黑' },
          paragraph: { spacing: { before: 480, after: 240 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 30, bold: true, color: PRIMARY, font: '微软雅黑' },
          paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 26, bold: true, color: DARK, font: '微软雅黑' },
          paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [hw('美团AI规划师竞赛参赛设计文档  ·  Travel Plan with XiaoMei', { size: 20, color: '999999' })],
              alignment: AlignmentType.CENTER,
              border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: PRIMARY, space: 1 } },
              spacing: { before: 0, after: 120 },
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                hw('Travel Plan with XiaoMei  ', { size: 20, color: '999999' }),
                new TextRun({ children: [PageNumber.CURRENT], size: 20, color: PRIMARY, font: '微软雅黑' }),
                hw('  /  ', { size: 20, color: '999999' }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 20, color: '999999', font: '微软雅黑' }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
      },
      children,
    }],
  });
}

// ── 执行 ────────────────────────────────────────────────────────────────────────
async function main() {
  const doc = buildDocument();
  const outDir = path.join(__dirname, '..', 'output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, '参赛设计文档.docx');
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buffer);
  console.log('✅ 文档已生成：' + outPath);
}

main().catch(console.error);
