/**
 * data-loader.js
 * 
 * 数据加载器：合并各理论体系的JSON数据文件
 * 标准化接口，供 graph.js 消费
 * 
 * 使用方式：在浏览器中 <script src="js/data-loader.js"></script>
 * 然后调用 await KnowledgeGraphLoader.load()
 */

const KnowledgeGraphLoader = (() => {
  // 数据文件路径（相对于 index.html）
  const DATA_FILES = [
    'data/theories/system-ontology.json',
    'data/theories/noo-ecology.json',
    'data/theories/civilization-dynamics.json'
  ];

  /**
   * 合并所有理论数据为统一的知识图谱
   * @returns {Object} { nodes, edges, theories }
   */
  async function load() {
    const raw = await Promise.all(
      DATA_FILES.map(async (path) => {
        const resp = await fetch(path);
        if (!resp.ok) throw new Error(`加载失败: ${path} (${resp.status})`);
        return resp.json();
      })
    );

    const theories = {};
    const nodes = [];
    const edges = [];
    const seenNodes = new Set();
    const seenEdges = new Set();

    for (const data of raw) {
      // 记录理论体系信息
      theories[data.theory.id] = {
        id: data.theory.id,
        label: data.theory.label,
        subtitle: data.theory.subtitle || '',
        author: data.theory.author || '',
        version: data.theory.version || '',
        description: data.theory.description || ''
      };

      // 合并节点（去重）
      for (const node of data.nodes) {
        if (!seenNodes.has(node.id)) {
          seenNodes.add(node.id);
          nodes.push({
            id: node.id,
            label: node.label,
            type: node.type,
            theory: node.theory,
            description: node.description,
            detail: node.detail || '',
            tags: node.tags || []
          });
        }
      }

      // 合并边（去重）
      for (const rel of (data.relationships || [])) {
        const key = `${rel.source}->${rel.target}:${rel.type}`;
        if (!seenEdges.has(key)) {
          seenEdges.add(key);
          edges.push({
            source: rel.source,
            target: rel.target,
            type: rel.type,
            label: rel.label || ''
          });
        }
      }
    }

    return { nodes, edges, theories };
  }

  return { load, DATA_FILES };
})();
