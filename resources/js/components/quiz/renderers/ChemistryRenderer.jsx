import React from 'react';
import SmiDrawer from 'smiles-drawer';

const ChemistryRenderer = ({ config }) => {
  const ref = React.useRef(null);
  
  React.useEffect(() => {
    if (ref.current && config.smiles) {
      try {
        const drawer = new SmiDrawer({
          width: 300,
          height: 300,
          bondThickness: 1.5,
        });
        drawer.draw(config.smiles, ref.current, 'light');
      } catch (e) {
        console.error("SMILES render error", e);
      }
    }
  }, [config.smiles]);

  return (
    <div className="flex flex-col items-center gap-2 p-4 border rounded bg-white">
      <canvas ref={ref} />
      {config.name && <p className="text-sm font-semibold">{config.name}</p>}
    </div>
  );
};

export default ChemistryRenderer;
