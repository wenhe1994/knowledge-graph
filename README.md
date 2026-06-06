# 智质生态学 · 互动知识图谱

系统本体论 · 智质生态学 · 文明动力学 —— 三套理论的互动知识图谱网站。

## 项目结构

```
knowledge-graph/
├── index.html              # 主页面（唯一的入口）
├── README.md               # 本文件
├── data/
│   ├── schema.json         # 数据标准定义（节点类型、关系类型、字段规范）
│   └── theories/
│       ├── system-ontology.json        # 系统本体论
│       ├── noo-ecology.json            # 智质生态学
│       └── civilization-dynamics.json  # 文明动力学
├── js/
│   ├── d3.min.js (可选)    # D3.js 库（使用CDN则不需要）
│   ├── data-loader.js      # 数据加载器（合并各JSON文件）
│   └── graph.js            # D3力导向图谱引擎
└── css/
    └── style.css           # 样式表
```

## 部署方式

### 方式一：GitHub Pages（推荐 · 零成本）

```bash
# 1. 在 GitHub 新建一个仓库（设为 public）
# 2. 将本目录推送到仓库
git init
git add .
git commit -m "初始提交：智质生态学知识图谱"
git remote add origin https://github.com/你的用户名/你的仓库名.git
git push -u origin main

# 3. 在仓库 Settings → Pages → 选择 main 分支 → 保存
# 4. 等待1分钟，访问 https://你的用户名.github.io/你的仓库名
```

### 方式二：Vercel（一键部署）

1. 将本目录推送到 GitHub
2. 登录 [vercel.com](https://vercel.com) → Import 该仓库
3. 框架选择 **Other** → 部署 → 完成
4. Vercel 自动生成 HTTPS 链接

### 方式三：任意静态服务器

```
# Python
python3 -m http.server 8080
# 然后访问 http://localhost:8080

# Node.js
npx serve .

# 或丢到 Nginx/Apache 的 web 目录
```

## 数据结构规范

### 添加新节点

编辑对应理论体系的 JSON 文件，在 `nodes` 数组中添加：

```json
{
  "id": "唯一标识符（英文下划线式）",
  "label": "显示名称",
  "type": "节点类型（见 schema.json 的 node_types）",
  "theory": "所属理论体系 id",
  "description": "核心定义（必填，显示在详情面板顶部）",
  "detail": "详细阐述（可选，点击后展开）",
  "tags": ["标签1", "标签2"]
}
```

### 添加新关系

在相同 JSON 文件的 `relationships` 数组中添加：

```json
{
  "source": "起点节点 id",
  "target": "终点节点 id",
  "type": "关系类型（见 schema.json 的 relationship_types）",
  "label": "关系标签（可选，显示在连线上）"
}
```

### 添加新的理论体系

1. 在 `data/theories/` 下创建新的 JSON 文件（参考现有文件格式）
2. 在 `js/data-loader.js` 的 `DATA_FILES` 数组中添加文件路径
3. 在 `index.html` 的 CSS 变量 `theoryColors` 中添加对应颜色（可选）

## 节点类型说明

| 类型 | 形状 | 颜色 | 用途 |
|------|------|------|------|
| `meta_axiom` | 六边形 🔴 | 红色 | 元公理（第一性原理） |
| `meta_theorem` | 六边形 🟠 | 橙色 | 元定理 |
| `axiom` | 菱形 🔵 | 蓝色 | 公理 |
| `theorem/corollary` | 圆形 🟢 | 绿色 | 定理 / 推论 |
| `concept` | 方形 🟣 | 紫色 | 核心概念 |
| `equation` | 三角形 🟡 | 黄色 | 形式化方程 |
| `model` | 星形 | 青色 | 理论模型 |
| `case` | 方形 ⚪ | 灰色 | 实例 |
| `anchor` | 六边形 | 粉色 | 跨学科锚点 |
| `method` | 菱形 | 紫色 | 方法论 |

## 交互说明

- **拖拽节点**：可拖动调整位置
- **滚轮**：缩放视图
- **点击节点**：右侧打开详情面板
- **悬停节点**：高亮关联路径和关联节点
- **搜索框**：按名称/描述/标签搜索
- **筛选按钮**：按理论体系显示/隐藏
- **Esc**：重置视图
- **/**：聚焦搜索框
