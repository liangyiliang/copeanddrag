const Graph = graphlib.Graph;
const alg = graphlib.alg;

const inferLayout = () => {
  const relationConstraintTable = createRelationConcreteConstraintsTable();
  const abstractConstraintsFromRelations =
    generateAbstractConstraintsFromRelations(relationConstraintTable);

  // Group constraints by relName
  for (const { relName, constraints } of abstractConstraintsFromRelations) {
    addOrientationConstraint(relName, constraints);
  }

  const sigConstraintTable = createSigConcreteConstraintsTable();
  const abstractConstraintsFromSigs =
    generateAbstractConstraintsFromRelations(sigConstraintTable);
  abstractConstraintsFromSigs.map(({ relName, constraints }) => {
    const [t0, t1] = relName.split("-");
    addOrientationConstraint(`${t0} -> ${t1}`, constraints);
  });

  addCycleConstraints();
};

const shapeConstraintEnergyFn = {
  left: (pos0, pos1) => {
    const { x: x0, y: y0, w: w0, h: h0 } = pos0;
    const { x: x1, y: y1, w: w1, h: h1 } = pos1;
    const diff = x0 - (x1 - w1 / 4);
    return diff < 0 ? 0 : diff + 10;
  },
  right: (pos0, pos1) => {
    const { x: x0, y: y0, w: w0, h: h0 } = pos0;
    const { x: x1, y: y1, w: w1, h: h1 } = pos1;
    const diff = x0 - (x1 + w1 / 4);
    return diff > 0 ? 0 : -diff + 10;
  },
  above: (pos0, pos1) => {
    const { x: x0, y: y0, w: w0, h: h0 } = pos0;
    const { x: x1, y: y1, w: w1, h: h1 } = pos1;
    const diff = y0 - (y1 - h1 / 4);
    return diff > 0 ? diff + 10 : 0;
  },
  below: (pos0, pos1) => {
    const { x: x0, y: y0, w: w0, h: h0 } = pos0;
    const { x: x1, y: y1, w: w1, h: h1 } = pos1;
    const diff = y0 - (y1 + h1 / 4);
    return diff < 0 ? -diff + 10 : 0;
  },
  directlyLeft: (pos0, pos1) => {
    return (
      shapeConstraintEnergyFn.left(pos0, pos1) +
      alignmentEnergyFn.horizontallyAligned(pos0, pos1)
    );
  },
  directlyRight: (pos0, pos1) => {
    return (
      shapeConstraintEnergyFn.right(pos0, pos1) +
      alignmentEnergyFn.horizontallyAligned(pos0, pos1)
    );
  },
  directlyAbove: (pos0, pos1) => {
    return (
      shapeConstraintEnergyFn.above(pos0, pos1) +
      alignmentEnergyFn.verticallyAligned(pos0, pos1)
    );
  },
  directlyBelow: (pos0, pos1) => {
    return (
      shapeConstraintEnergyFn.below(pos0, pos1) +
      alignmentEnergyFn.verticallyAligned(pos0, pos1)
    );
  },
};

const alignmentEnergyFn = {
  horizontallyAligned: (pos0, pos1) => {
    const { x: x0, y: y0, w: w0, h: h0 } = pos0;
    const { x: x1, y: y1, w: w1, h: h1 } = pos1;
    const diff = Math.abs(y0 - y1) - (h0 + h1) / 2 / 4;
    return diff < 0 ? 0 : diff;
  },
  verticallyAligned: (pos0, pos1) => {
    const { x: x0, y: y0, w: w0, h: h0 } = pos0;
    const { x: x1, y: y1, w: w1, h: h1 } = pos1;
    const diff = Math.abs(x0 - x1) - (w0 + w1) / 2 / 4;
    return diff < 0 ? 0 : diff;
  },
};

const createRelationConcreteConstraintsTable = () => {
  const edges = window.getEdges();
  const nodes = window.getNodes();

  const relationConstraintTable = [];
  for (const edge of edges) {
    const { source, target, relName, id: edgeId } = edge;
    const sourceName = source.id;
    const targetName = target.id;
    const pos1 = {
      x: source.x,
      y: source.y,
      w: source.width,
      h: source.height,
    };
    const pos0 = {
      x: target.x,
      y: target.y,
      w: target.width,
      h: target.height,
    };

    const shapeConstraintEnergyValues = {};
    for (const [constrName, energyFn] of Object.entries(
      shapeConstraintEnergyFn
    )) {
      const energy = energyFn(pos0, pos1);
      shapeConstraintEnergyValues[constrName] = energy;
    }

    const record = {
      relName,
      sourceName,
      targetName,
      edgeId,
      shapeConstraintEnergyValues,
    };
    relationConstraintTable.push(record);
  }
  return relationConstraintTable;
};

const generateAbstractConstraintsFromRelations = (table) => {
  const relationEdgeMap = new Map();
  for (const record of table) {
    const { relName, sourceName, targetName, shapeConstraintEnergyValues } =
      record;
    if (!relationEdgeMap.has(relName)) {
      relationEdgeMap.set(relName, []);
    }
    relationEdgeMap.get(relName).push({
      sourceName: sourceName,
      targetName: targetName,
      shapeConstraintEnergyValues,
    });
  }

  const abstractConstraints = [];
  for (const [relName, edges] of relationEdgeMap.entries()) {
    const appropriateConstraints = Object.keys(shapeConstraintEnergyFn).filter(
      (c) =>
        edges
          .map((edge) => edge.shapeConstraintEnergyValues[c])
          .every((v) => v < 0.5)
    );
    if (appropriateConstraints.length !== 0) {
      abstractConstraints.push({
        relName,
        constraints: appropriateConstraints,
      });
    }
  }

  return abstractConstraints;
};

const createSigConcreteConstraintsTable = () => {
  const nodes = window.getNodes();

  const sigConstraintTable = [];
  for (const n0 of nodes) {
    for (const n1 of nodes) {
      const t0 = n0.mostSpecificType,
        t1 = n1.mostSpecificType;
      if (t0 !== t1) {
        const pos0 = {
          x: n1.x,
          y: n1.y,
          w: n1.width,
          h: n1.height,
        };
        const pos1 = {
          x: n0.x,
          y: n0.y,
          w: n0.width,
          h: n0.height,
        };

        const shapeConstraintEnergyValues = {};
        for (const [constrName, energyFn] of Object.entries(
          shapeConstraintEnergyFn
        )) {
          const energy = energyFn(pos0, pos1);
          shapeConstraintEnergyValues[constrName] = energy;
        }

        sigConstraintTable.push({
          relName: `${t0}-${t1}`,
          typeSource: t0,
          typeTarget: t1,
          sourceName: n0.id,
          targetName: n1.id,
          shapeConstraintEnergyValues,
        });
      }
    }
  }
  return sigConstraintTable;
};

const addCycleConstraints = () => {
  console.log("Adding cycle constraints...");
  const edges = window.getEdges();
  const nodes = window.getNodes();
  const relNames = Array.from(new Set(edges.map((e) => e.relName)));

  for (const relName of relNames) {
    const cyclableNodeIDs = gatherCyclableNodes(relName);
    const cyclableNodes = cyclableNodeIDs.map((id) =>
      nodes.find((n) => n.id === id)
    ); // array of nodes
    const cycleResult = detectCycle(cyclableNodes);
    console.log(`Cycle detection for relation ${relName}:`, cycleResult);
    if (cyclableNodes.length >= 4 && cycleResult !== "no cycle") {
      addCyclicConstraint(relName, cycleResult);
    }
  }
};

const dist = (pos0, pos1) => {
  const dx = pos0.x - pos1.x;
  const dy = pos0.y - pos1.y;
  return Math.sqrt(dx * dx + dy * dy);
};
const isIncreasing = (arr) => {
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] <= arr[i - 1]) {
      return false;
    }
  }
  return true;
};

const totalSweep = (poss, center) => {
  console.log("poss");
  console.log(poss);
  const { x: cx, y: cy } = center;

  const angleFromCenter = (x, y, cx, cy) => {
    const dx = x - cx;
    const dy = y - cy;
    return Math.atan2(dy, dx);
  };

  let total = 0;

  for (let i = 0; i < poss.length; i++) {
    const { x: x0, y: y0 } = poss[i];
    const { x: x1, y: y1 } = poss[(i + 1) % poss.length];
    const a0 = angleFromCenter(x0, y0, cx, cy);
    const a1 = angleFromCenter(x1, y1, cx, cy);
    console.log("a0 " + a0 + " a1 " + a1);
    const delta = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0));
    console.log("delta " + delta);
    total += Math.abs(delta);
  }

  return total;
};

const detectCycle = (nodes) => {
  const poss = nodes.map((n) => ({ x: n.x, y: n.y }));
  const sumCenter = poss.reduce(
    (acc, pos) => {
      return { x: acc.x + pos.x, y: acc.y + pos.y };
    },
    { x: 0, y: 0 }
  );
  const avgCenter = {
    x: sumCenter.x / poss.length,
    y: sumCenter.y / poss.length,
  };

  // check that the nodes are of similar distance to the center
  const distancesToCenter = poss.map((pos) => dist(pos, avgCenter));
  const minDistToCenter = Math.min(...distancesToCenter);
  const maxDistToCenter = Math.max(...distancesToCenter);
  if (maxDistToCenter - minDistToCenter >= 100) {
    return "no cycle";
  }

  // check that the path along the edges wraps around the center
  const sweep = totalSweep(poss, avgCenter);
  console.log(sweep);
  if (Math.abs(sweep - 2 * Math.PI) > 0.5) {
    return "no cycle";
  }

  // now detect clockwise/counterclockwise
  const leftmostIndex = poss.reduce((minIndex, pos, index) => {
    return pos.x < poss[minIndex].x ? index : minIndex;
  }, 0);

  const leftmostNodePos = poss[leftmostIndex];
  const nextNodePos = poss[(leftmostIndex + 1) % poss.length];
  // reminder that CnD coordinate system is upside down
  if (leftmostNodePos.y < nextNodePos.y) {
    return "counterclockwise";
  } else {
    return "clockwise";
  }
};

const gatherCyclableNodes = (relName) => {
  const graph = new graphlib.Graph();
  const edges = window.getEdges().filter((e) => e.relName === relName);
  for (const edge of edges) {
    graph.setEdge(edge.source.id, edge.target.id, edge);
  }

  const graphType = checkSingleRingOrLine(graph);

  if (graphType === "none") {
    return [];
  }

  if (graph.nodes().length < 4) {
    return [];
  }

  if (graphType === "ring") {
    const n0 = graph.nodes()[0];
    const n1 = graph.successors(n0)[0];
    graph.removeEdge(n0, n1);
  }

  const cyclableNodes = graphlib.alg.topsort(graph);

  return cyclableNodes;
};

const checkSingleRingOrLine = (graph) => {
  const nodes = graph.nodes();
  let inOneComponent = true;
  // Check weak connectivity (for line) or strong connectivity (for ring)
  if (graphlib.alg.components(graph).length !== 1) {
    inOneComponent = false;
  }

  // Count in/out degrees
  let inOnes = 0,
    outOnes = 0,
    inZeros = 0,
    outZeros = 0,
    allOnes = true;
  for (const node of nodes) {
    const inDeg = graph.inEdges(node).length;
    const outDeg = graph.outEdges(node).length;
    if (inDeg === 1 && outDeg === 1) continue;
    allOnes = false;
    if (inDeg === 0) inZeros++;
    if (outDeg === 0) outZeros++;
    if (inDeg === 1) inOnes++;
    if (outDeg === 1) outOnes++;
  }

  // Check for ring
  if (allOnes && inOneComponent) {
    return "ring";
  }
  // Check for line: exactly one node with in-degree 0 (start), one with out-degree 0 (end), rest have in/out degree 1
  if (
    inZeros === 1 &&
    outZeros === 1 &&
    inOnes + outOnes === (nodes.length - 2) * 2 &&
    inOneComponent
  ) {
    return "line";
  }
  return "none";
};
