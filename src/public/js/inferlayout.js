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
