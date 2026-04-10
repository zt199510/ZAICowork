import type { LucideIcon } from 'lucide-react'
import {
  Blocks,
  FolderSearch,
  ListTodo,
  Settings2,
  Sparkles,
  WandSparkles,
} from 'lucide-react'
import type { ModuleView } from '../../types/workbench'

type ModuleDescriptor = {
  kicker: string
  title: string
  description: string
  primaryAction: string
  secondaryAction: string
  cards: Array<{
    title: string
    value: string
    detail: string
    icon: LucideIcon
  }>
  checklistTitle: string
  checklist: string[]
  notesTitle: string
  notes: string[]
}

const moduleContent: Record<ModuleView, ModuleDescriptor> = {
  tasks: {
    kicker: 'Delivery Console',
    title: '任务编排工作台',
    description: '这里将承接执行队列、审批节点、阶段计划与回放记录，布局与主工作台保持同一套视觉语言。',
    primaryAction: '新建工作流',
    secondaryAction: '查看最近运行',
    cards: [
      { title: '计划模板', value: '08', detail: '适配当前开发流程的阶段模板', icon: ListTodo },
      { title: '运行回放', value: '14', detail: '最近会话的执行回溯与状态快照', icon: Blocks },
      { title: '审批节点', value: '03', detail: '等待确认或人工检查的步骤', icon: Sparkles },
    ],
    checklistTitle: '首轮落地内容',
    checklist: ['执行队列视图', '审批提示条', '阶段状态卡片', '回放详情抽屉'],
    notesTitle: '设计说明',
    notes: ['沿用右侧检查面板的视觉层级。', '保留未来接入后台运行状态的卡槽。', '把计划和回放拆成独立信息段，而不是堆成一个列表。'],
  },
  resources: {
    kicker: 'Knowledge Surface',
    title: '资源与上下文中心',
    description: '用于承接文档、仓库条目、产物和外部链接，让资源页成为主工作台外的第二个高频入口。',
    primaryAction: '导入资源',
    secondaryAction: '浏览索引',
    cards: [
      { title: '仓库文档', value: '26', detail: '包含研发计划与说明文档', icon: FolderSearch },
      { title: '运行产物', value: '11', detail: '最近输出的报告、日志与摘要', icon: Blocks },
      { title: '上下文片段', value: '34', detail: '常驻引用和快速插入内容', icon: Sparkles },
    ],
    checklistTitle: '首轮落地内容',
    checklist: ['资源分组', '快速筛选', '最近访问', '右侧详情预览'],
    notesTitle: '设计说明',
    notes: ['资源页保持更强的信息面板感。', '卡片和列表应支持未来的过滤条件。', '优先确保目录感和检索感，而不是一次塞进全部功能。'],
  },
  skills: {
    kicker: 'Agent Toolkit',
    title: '技能与提示配置',
    description: '这里承接技能模板、提示策略、工具约束和运行偏好，让工作台具备更明显的“可编排 AI IDE”气质。',
    primaryAction: '新增技能',
    secondaryAction: '查看模板',
    cards: [
      { title: '技能模板', value: '12', detail: '覆盖调试、规划和文档等能力域', icon: WandSparkles },
      { title: '运行约束', value: '07', detail: '定义审批、只读和工具边界', icon: Sparkles },
      { title: '快捷提示', value: '18', detail: '面向常见工程任务的快速入口', icon: Blocks },
    ],
    checklistTitle: '首轮落地内容',
    checklist: ['模板列表', '详情抽屉', '启用状态', '复制与应用入口'],
    notesTitle: '设计说明',
    notes: ['卡片密度要低于资源页，让配置动作更清晰。', '保留未来分组和搜索插槽。', '避免把技能页做成纯表单页，仍然要保留工作台质感。'],
  },
  settings: {
    kicker: 'System Preferences',
    title: '工作台设置中心',
    description: '集中承接主题、布局密度、运行策略和连接设置，视觉上与 OpenCowork 的设置页面保持统一。',
    primaryAction: '保存更改',
    secondaryAction: '恢复默认',
    cards: [
      { title: '界面主题', value: 'Dark', detail: '基于中性色的桌面工作台主题', icon: Settings2 },
      { title: '布局密度', value: 'Comfort', detail: '为多面板工作流预留清晰呼吸感', icon: Blocks },
      { title: '运行策略', value: 'Manual', detail: '默认保守的审批与执行方式', icon: Sparkles },
    ],
    checklistTitle: '首轮落地内容',
    checklist: ['主题组', '模型默认值', '日志级别', '动画开关'],
    notesTitle: '设计说明',
    notes: ['设置页要像“系统中心”，不是纯弹窗。', '左侧可继续保留分组导航。', '把影响体验一致性的 token 选项放在前面。'],
  },
}

export function ModulePage({ view }: { view: ModuleView }) {
  const content = moduleContent[view]

  return (
    <section className="module-page">
      <header className="module-page__hero">
        <div>
          <p className="section-kicker">{content.kicker}</p>
          <h1 className="module-page__title">{content.title}</h1>
          <p className="module-page__description">{content.description}</p>
        </div>

        <div className="module-page__actions">
          <button type="button" className="button button--ghost">
            {content.secondaryAction}
          </button>
          <button type="button" className="button button--primary">
            {content.primaryAction}
          </button>
        </div>
      </header>

      <div className="module-page__metrics">
        {content.cards.map((card) => {
          const Icon = card.icon

          return (
            <article key={card.title} className="module-card">
              <div className="module-card__icon-wrap">
                <Icon className="module-card__icon" />
              </div>
              <p className="module-card__label">{card.title}</p>
              <h2 className="module-card__value">{card.value}</h2>
              <p className="module-card__detail">{card.detail}</p>
            </article>
          )
        })}
      </div>

      <div className="module-page__grid">
        <section className="module-panel">
          <p className="module-panel__label">{content.checklistTitle}</p>
          <ol className="module-panel__list module-panel__list--ordered">
            {content.checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>

        <section className="module-panel">
          <p className="module-panel__label">{content.notesTitle}</p>
          <ul className="module-panel__list">
            {content.notes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  )
}