/**
 * graph.js
 * 
 * D3.js 力导向知识图谱可视化引擎
 * 
 * 核心功能：
 * - 力导向布局
 * - 按节点类型着色/定形
 * - 点击展开详情面板
 * - 搜索节点
 * - 按理论体系筛选
 * - 悬停高亮关联路径
 */

const KnowledgeGraph = (() => {
  // ------ 配置 ------
  const SCHEMA_PATH = 'data/schema.json';

  const DEFAULTS = {
    width: window.innerWidth,
    height: window.innerHeight,
    chargeStrength: -400,
    linkDistance: 150,
    collisionRadius: 50,
    nodeRadius: 28
  };

  let schema = null;
  let svg = null;
  let simulation = null;
  let gLinks = null;
  let gNodes = null;
  let gLabels = null;
  let zoomBehavior = null;
  let linkGroup = null;

  // 状态
  const state = {
    nodes: [],
    edges: [],
    theories: {},
    searchQuery: '',
    activeFilters: new Set(),
    selectedNode: null,
    highlightedIds: new Set(),
    showUnconnected: false
  };

  // DOM 引用
  let container = null;
  let tooltip = null;
  let detailPanel = null;

  // ------ 数据加载 ------
  async function init(containerId = 'graph-container') {
    container = document.getElementById(containerId);
    if (!container) throw new Error(`容器 #${containerId} 未找到`);

    // 加载 schema
    const schemaResp = await fetch(SCHEMA_PATH);
    schema = await schemaResp.json();

    // 加载图谱数据
    const data = await KnowledgeGraphLoader.load();
    state.theories = data.theories;

    // 初始化节点和边
    state.nodes = data.nodes.map(n => ({ ...n }));
    state.edges = data.edges.map(e => ({
      source: e.source,
      target: e.target,
      type: e.type,
      label: e.label
    }));

    // 构建 UI
    setupLayout();
    render();

    // 窗口自适应
    window.addEventListener('resize', () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      svg.attr('width', w).attr('height', h);
      if (simulation) simulation.alpha(0.3).restart();
    });
  }

  // ------ 布局 ------
  function setupLayout() {
    // 主容器
    container.style.position = 'relative';
    container.style.overflow = 'hidden';

    // SVG
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', container.clientWidth);
    svg.setAttribute('height', container.clientHeight);
    container.appendChild(svg);

    // 背景点击取消选择
    svg.addEventListener('click', (e) => {
      if (e.target === svg) {
        deselectNode();
      }
    });

    // 缩放行为
    zoomBehavior = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        d3.select(svg).selectAll('g.graph-group').attr('transform', event.transform);
      });

    d3.select(svg).call(zoomBehavior);

    // 图组
    const graphGroup = d3.select(svg).append('g').attr('class', 'graph-group');
    linkGroup = graphGroup.append('g').attr('class', 'links');
    gLinks = linkGroup;
    gNodes = graphGroup.append('g').attr('class', 'nodes');
    gLabels = graphGroup.append('g').attr('class', 'labels');
  }

  // ------ 节点样式 ------
  function getNodeColor(type) {
    if (schema && schema.node_types[type]) return schema.node_types[type].color;
    return '#999';
  }

  function getNodeShape(type) {
    if (schema && schema.node_types[type]) return schema.node_types[type].shape;
    return 'circle';
  }

  function getNodeTypeLabel(type) {
    if (schema && schema.node_types[type]) return schema.node_types[type].label;
    return type;
  }

  function getEdgeColor(type) {
    if (schema && schema.relationship_types[type]) return schema.relationship_types[type].color;
    return '#999';
  }

  function getEdgeStyle(type) {
    if (schema && schema.relationship_types[type]) return schema.relationship_types[type].style || 'solid';
    return 'solid';
  }

  // ------ 渲染核心 ------
  function render() {
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 过滤节点：按搜索和理论筛选
    const visibleNodes = state.nodes.filter(n => {
      // 理论筛选
      if (state.activeFilters.size > 0 && !state.activeFilters.has(n.theory)) return false;
      // 搜索筛选
      if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        if (!n.label.toLowerCase().includes(q) &&
            !n.description.toLowerCase().includes(q) &&
            !n.tags.some(t => t.toLowerCase().includes(q))) return false;
      }
      return true;
    });

    const visibleIds = new Set(visibleNodes.map(n => n.id));

    // 过滤边：仅包含两端都可见的边
    const visibleEdges = state.edges.filter(e => {
      const sid = typeof e.source === 'object' ? e.source.id : e.source;
      const tid = typeof e.target === 'object' ? e.target.id : e.target;
      return visibleIds.has(sid) && visibleIds.has(tid);
    });

    // 构建 D3 数据
    const d3Nodes = visibleNodes.map(n => ({
      ...n,
      x: undefined,
      y: undefined,
      fx: null,
      fy: null
    }));

    const d3Edges = visibleEdges.map(e => ({
      source: typeof e.source === 'object' ? e.source.id : e.source,
      target: typeof e.target === 'object' ? e.target.id : e.target,
      type: e.type,
      label: e.label
    }));

    // 力模拟
    if (simulation) simulation.stop();

    simulation = d3.forceSimulation(d3Nodes)
      .force('link', d3.forceLink(d3Edges).id(d => d.id).distance(DEFAULTS.linkDistance))
      .force('charge', d3.forceManyBody().strength(DEFAULTS.chargeStrength))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide(DEFAULTS.collisionRadius))
      .alphaDecay(0.02);

    // 绘制边
    const linkSelection = gLinks.selectAll('g.link-group')
      .data(d3Edges, d => `${d.source.id || d.source}-${d.target.id || d.target}-${d.type}`);

    linkSelection.exit().remove();

    const linkEnter = linkSelection.enter().append('g').attr('class', 'link-group');

    linkEnter.append('line')
      .attr('class', 'link-line')
      .attr('stroke', d => getEdgeColor(d.type))
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', d => {
        const style = getEdgeStyle(d.type);
        return style === 'dashed' ? '6,4' : style === 'dotted' ? '2,4' : 'none';
      })
      .attr('opacity', 0.5);

    linkEnter.append('text')
      .attr('class', 'link-label')
      .attr('fill', '#888')
      .attr('font-size', 10)
      .attr('text-anchor', 'middle')
      .attr('dy', -4)
      .text(d => d.label)
      .attr('opacity', 0);

    // 合并 + 更新
    const linkMerge = linkEnter.merge(linkSelection);
    linkMerge.select('line')
      .attr('stroke', d => {
        if (state.highlightedIds.size > 0) {
          const sid = typeof d.source === 'object' ? d.source.id : d.source;
          const tid = typeof d.target === 'object' ? d.target.id : d.target;
          return state.highlightedIds.has(sid) && state.highlightedIds.has(tid)
            ? getEdgeColor(d.type) : '#eee';
        }
        return getEdgeColor(d.type);
      })
      .attr('opacity', d => {
        if (state.highlightedIds.size > 0) {
          const sid = typeof d.source === 'object' ? d.source.id : d.source;
          const tid = typeof d.target === 'object' ? d.target.id : d.target;
          return state.highlightedIds.has(sid) && state.highlightedIds.has(tid) ? 0.8 : 0.05;
        }
        return 0.5;
      });

    // 绘制节点
    const nodeSelection = gNodes.selectAll('g.node-group')
      .data(d3Nodes, d => d.id);

    nodeSelection.exit().remove();

    const nodeEnter = nodeSelection.enter().append('g').attr('class', 'node-group')
      .attr('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        selectNode(d);
      })
      .on('mouseenter', (event, d) => highlightNode(d))
      .on('mouseleave', () => clearHighlight())
      .call(d3.drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      );

    // 节点形状
    nodeEnter.each(function(d) {
      const group = d3.select(this);
      const shape = getNodeShape(d.type);
      const color = getNodeColor(d.type);
      const r = DEFAULTS.nodeRadius;

      switch (shape) {
        case 'hexagon':
          group.append('polygon')
            .attr('points', hexagonPoints(0, 0, r))
            .attr('fill', color)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);
          break;
        case 'diamond':
          group.append('polygon')
            .attr('points', `${0},${-r} ${r},${0} ${0},${r} ${-r},${0}`)
            .attr('fill', color)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);
          break;
        case 'triangle':
          group.append('polygon')
            .attr('points', `${0},${-r} ${-r*0.87},${r*0.5} ${r*0.87},${r*0.5}`)
            .attr('fill', color)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);
          break;
        case 'star':
          group.append('polygon')
            .attr('points', starPoints(0, 0, r, r * 0.45, 5))
            .attr('fill', color)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);
          break;
        default: // circle / square
          if (shape === 'square') {
            group.append('rect')
              .attr('x', -r * 0.8).attr('y', -r * 0.8)
              .attr('width', r * 1.6).attr('height', r * 1.6)
              .attr('rx', 4)
              .attr('fill', color)
              .attr('stroke', '#fff')
              .attr('stroke-width', 2);
          } else {
            group.append('circle')
              .attr('r', r)
              .attr('fill', color)
              .attr('stroke', '#fff')
              .attr('stroke-width', 2);
          }
      }
    });

    // 标签
    const labelSelection = gLabels.selectAll('text.node-label')
      .data(d3Nodes, d => d.id);

    labelSelection.exit().remove();

    const labelEnter = labelSelection.enter().append('text')
      .attr('class', 'node-label')
      .attr('text-anchor', 'middle')
      .attr('dy', DEFAULTS.nodeRadius + 14)
      .attr('font-size', 10)
      .attr('fill', '#555')
      .attr('pointer-events', 'none')
      .text(d => d.label.length > 18 ? d.label.slice(0, 16) + '…' : d.label);

    // 合并更新
    const nodeMerge = nodeEnter.merge(nodeSelection);
    const labelMerge = labelEnter.merge(labelSelection);

    // 模拟 tick
    simulation.on('tick', () => {
      linkMerge.select('line')
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      linkMerge.select('text')
        .attr('x', d => (d.source.x + d.target.x) / 2)
        .attr('y', d => (d.source.y + d.target.y) / 2);

      nodeMerge.attr('transform', d => `translate(${d.x},${d.y})`);
      labelMerge.attr('x', d => d.x).attr('y', d => d.y + DEFAULTS.nodeRadius + 14);
    });

    // 初始高仿真动画
    simulation.alpha(1).restart();
  }

  // 形状辅助函数
  function hexagonPoints(cx, cy, r) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 3 * i - Math.PI / 6;
      pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
    }
    return pts.join(' ');
  }

  function starPoints(cx, cy, outer, inner, points) {
    const pts = [];
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const angle = Math.PI / points * i - Math.PI / 2;
      pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
    }
    return pts.join(' ');
  }

  // ------ 交互：节点选择 ------
  function selectNode(d) {
    state.selectedNode = d;
    renderDetailPanel(d);
    // 高亮
    highlightRelated(d);
    // 隐藏tooltip
    if (tooltip) tooltip.style.display = 'none';
  }

  function deselectNode() {
    state.selectedNode = null;
    state.highlightedIds.clear();
    if (detailPanel) detailPanel.innerHTML = '';
    resetOpacity();
    if (tooltip) tooltip.style.display = 'none';
  }

  function renderDetailPanel(d) {
    if (!detailPanel) return;
    const typeLabel = getNodeTypeLabel(d.type);
    const theoryInfo = state.theories[d.theory] || { label: d.theory };
    const color = getNodeColor(d.type);

    detailPanel.innerHTML = `
      <div class="detail-header" style="border-left: 4px solid ${color};">
        <span class="detail-type" style="background:${color};">${typeLabel}</span>
        <span class="detail-theory">${theoryInfo.label}</span>
      </div>
      <h2 class="detail-title">${d.label}</h2>
      <div class="detail-desc">${d.description}</div>
      ${d.detail ? `<div class="detail-body"><h3>详细阐述</h3><p>${d.detail.replace(/\n/g, '<br>')}</p></div>` : ''}
      ${d.tags && d.tags.length > 0 ? `
        <div class="detail-tags">
          ${d.tags.map(t => `<span class="tag">${t}</span>`).join('')}
        </div>
      ` : ''}
    `;
  }

  // ------ 交互：高亮关联路径 ------
  function highlightNode(d) {
    highlightRelated(d);
    // 精简tooltip
    if (tooltip) {
      tooltip.innerHTML = `<strong>${d.label}</strong><br><small>${d.description.slice(0, 80)}${d.description.length > 80 ? '…' : ''}</small>`;
      tooltip.style.display = 'block';
    }
  }

  function highlightRelated(d) {
    const related = new Set([d.id]);
    // 找到所有直接相连的节点
    state.edges.forEach(e => {
      const sid = typeof e.source === 'object' ? e.source.id : e.source;
      const tid = typeof e.target === 'object' ? e.target.id : e.target;
      if (sid === d.id) related.add(tid);
      if (tid === d.id) related.add(sid);
    });
    state.highlightedIds = related;
    updateOpacity(related);
  }

  function clearHighlight() {
    if (!state.selectedNode) {
      state.highlightedIds.clear();
      resetOpacity();
    }
    if (tooltip) tooltip.style.display = 'none';
  }

  function updateOpacity(visibleIds) {
    d3.select(svg).selectAll('g.node-group')
      .attr('opacity', d => visibleIds.has(d.id) ? 1 : 0.15);

    d3.select(svg).selectAll('text.node-label')
      .attr('opacity', d => visibleIds.has(d.id) ? 1 : 0.1);
  }

  function resetOpacity() {
    d3.select(svg).selectAll('g.node-group').attr('opacity', 1);
    d3.select(svg).selectAll('text.node-label').attr('opacity', 1);
  }

  // ------ 公共 API ------
  return {
    async init(containerId) {
      await init(containerId);
      return this;
    },

    setTooltip(el) { tooltip = el; return this; },
    setDetailPanel(el) { detailPanel = el; return this; },

    search(query) {
      state.searchQuery = query;
      render();
    },

    filterByTheory(theoryId) {
      if (state.activeFilters.has(theoryId)) {
        state.activeFilters.delete(theoryId);
      } else {
        state.activeFilters.add(theoryId);
      }
      render();
    },

    setFilter(theoryId, enabled) {
      if (enabled) state.activeFilters.add(theoryId);
      else state.activeFilters.delete(theoryId);
      render();
    },

    getTheories() { return state.theories; },

    resetView() {
      state.searchQuery = '';
      state.activeFilters.clear();
      deselectNode();
      render();
      // 重置缩放
      d3.select(svg).transition().duration(500).call(zoomBehavior.transform, d3.zoomIdentity);
    }
  };
})();
