const inferLayout = () => {
  const edges = window.getEdges();
  const nodes = window.getNodes();

  const table = [];
  for (const edge of edges) {
    const { source, target, relName, id: edgeId } = edge;
    const sourceName = source.id;
    const targetName = target.id;
    const pos0 = {
      x: source.x,
      y: source.y,
      w: source.width,
      h: source.height,
    };
    const pos1 = {
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
    table.push(record);
  }
  console.log(table);
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
