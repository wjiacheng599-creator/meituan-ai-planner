# Image 2 技术图生成提示词

以下提示词用于生成适合参赛设计文档的平面简洁技术图。建议每张图单独生成，生成后再用 PPT、Figma 或脚本叠加中文标签，以避免模型把中文画糊。

## 1. 系统总体架构图

```text
Use case: infographic-diagram
Asset type: framework diagram for a Chinese technical competition design document
Primary request: Create a clean flat technical documentation style system architecture diagram background for a local-life AI planning app. The app converts a natural-language weekend activity goal into a validated plan and executable booking workflow, then learns user preferences over time.

Visual style: flat vector, white or very light gray background, high whitespace, thin outlines, rounded rectangles, subtle shadows, enterprise SaaS documentation style. Use Meituan-inspired yellow as a small accent, with blue, green, purple, and pink supporting colors. No glassmorphism, no 3D, no glossy lighting, no neon, no heavy gradients.

Composition: five horizontal layers stacked from top to bottom, connected by simple vertical arrows:
1. Experience layer
2. Planning intelligence layer
3. Execution agent layer
4. Memory growth layer
5. Reliability and data layer

Inside each layer, place several blank module cards for labels to be added later. Include minimal line icons only: chat bubble, calendar/checklist, map pin, gear, database, shield, clock. Keep all text areas blank and clean.

Text policy: absolutely no text, no letters, no numbers, no pseudo text, no watermark.
Aspect ratio: 16:9, high resolution.
```

## 2. 多 Agent 规划链路图

```text
Use case: infographic-diagram
Asset type: workflow diagram for a Chinese technical design document
Primary request: Create a clean flat vector workflow diagram showing a constraint-first multi-agent planning engine for a local-life AI planner. The engine receives a natural-language goal, extracts constraints, runs place and weather agents in parallel, sends results to a strategy agent, validates the plan, and outputs an executable itinerary.

Visual style: flat technical documentation style, professional, minimal, white/light gray background, rounded cards, thin connector arrows, high whitespace. Use blue for input and orchestration, yellow for place data, green for weather/context, purple for strategy, pink for validation. No glassmorphism, no 3D, no glossy effects, no decorative background.

Composition: left-to-right workflow.
- Left: one input card with blank label area
- Middle-left: two parallel cards stacked vertically for place context and weather context
- Middle-right: one larger strategy/orchestration card
- Right: one validation/output card
- Bottom: one slim callout bar for the key innovation

Keep all cards and callout bars blank for later Chinese labels. Use simple line icons such as target, location pin, cloud/sun, route, checkmark.

Text policy: absolutely no text, no letters, no numbers, no pseudo text, no watermark.
Aspect ratio: 16:9, high resolution.
```

## 3. 执行 Agent DAG 图

```text
Use case: infographic-diagram
Asset type: execution DAG diagram for a Chinese technical design document
Primary request: Create a clean flat vector diagram showing how an execution agent compiles a confirmed plan into a dependency graph. It should show route calculation branching into parallel availability checks, then restaurant reservation and activity booking, then a unified confirmation result. The diagram should communicate same-level parallel execution, idempotent retry, compensation, and progress streaming.

Visual style: flat technical documentation style, enterprise SaaS, white/light gray background, rounded node cards, thin directed arrows, minimal icons, generous whitespace. Use blue, yellow, green, purple, and pink accents. No glassmorphism, no 3D, no neon, no glossy effects, no complex textures.

Composition: left-to-right DAG:
- Far left: one start node
- Middle-left: two parallel check nodes stacked vertically
- Middle-right: two parallel execution nodes stacked vertically
- Far right: one unified result node
- Bottom: three small pill-shaped capability tags

All node cards and tags should have blank label areas. Use simple line icons such as route, fork, ticket, restaurant, payment, progress.

Text policy: absolutely no text, no letters, no numbers, no pseudo text, no watermark.
Aspect ratio: 16:9, high resolution.
```

## 4. 长期记忆飞轮图

```text
Use case: infographic-diagram
Asset type: memory flywheel diagram for a Chinese technical design document
Primary request: Create a clean flat vector diagram showing a long-term personalization memory flywheel for a local-life AI planning app. The app learns from explicit user profiles, behavior events, and completed task outcomes, converts them into Travel DNA, updates a unified user profile and a local memory index, then uses them to improve the next plan and generate trip memoirs.

Visual style: flat technical documentation style, warm but professional, white/light gray background, rounded cards, thin arrows, high whitespace, simple iconography. Use blue for explicit profile, yellow for behavior events, green for completed outcomes, purple for Travel DNA, blue/green for profile and memory index, pink for next planning and loop-back. No glassmorphism, no 3D, no glossy lighting, no heavy gradients.

Composition:
- Left column: three source cards stacked vertically
- Center: one larger Travel DNA card
- Right-middle: two cards stacked vertically for unified profile and memory index
- Far right: one next-planning card
- Bottom: loop-back arrow from next planning to completed outcomes
- Optional small icon for memoir/story generation near the memory index

Keep all cards blank for later Chinese labels. Use simple line icons such as user profile, click/event, check-in, DNA/fingerprint abstract mark, archive, story/book.

Text policy: absolutely no text, no letters, no numbers, no pseudo text, no watermark.
Aspect ratio: 16:9, high resolution.
```
