// ============================================
// code.ts (compile to code.js)
// ============================================

/// <reference types="@figma/plugin-typings" />

figma.showUI(__html__, { width: 500, height: 900 });

// Send existing collections to UI on startup
(async () => {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const collectionList = collections.map(c => ({
    id: c.id,
    name: c.name,
    modes: c.modes.map(m => ({ id: m.modeId, name: m.name }))
  }));
  
  figma.ui.postMessage({
    type: 'collections-loaded',
    collections: collectionList
  });
})();

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'import-colors') {
    try {
      const data = msg.data;
      const collectionChoice = msg.collectionChoice;
      
      console.log('Collection choice:', collectionChoice);
      console.log('New collection name:', msg.newCollectionName);
      
      let collection: VariableCollection;
      
      // Get or create collection based on user choice
      if (collectionChoice === 'new') {
        const newName = msg.newCollectionName || 'Brand Colors';
        console.log('Creating new collection:', newName);
        collection = figma.variables.createVariableCollection(newName);
      } else {
        console.log('Looking for existing collection with ID:', collectionChoice);
        const collections = await figma.variables.getLocalVariableCollectionsAsync();
        console.log('Available collections:', collections.map(c => ({ id: c.id, name: c.name })));
        const foundCollection = collections.find(c => c.id === collectionChoice);
        if (!foundCollection) {
          throw new Error(`Selected collection not found. ID: ${collectionChoice}`);
        }
        collection = foundCollection;
      }
      
      // Get or create modes
      const modes = collection.modes;
      let lightMode = modes.find(m => m.name === 'Light');
      let darkMode = modes.find(m => m.name === 'Dark');
      
      if (!lightMode) {
        if (modes.length > 0 && modes[0].name === 'Mode 1') {
          collection.renameMode(modes[0].modeId, 'Light');
          lightMode = modes[0];
        } else {
          lightMode = modes[0] || { modeId: collection.modes[0].modeId, name: collection.modes[0].name };
        }
      }
      
      if (!darkMode) {
        const darkModeId = collection.addMode('Dark');
        darkMode = { modeId: darkModeId, name: 'Dark' };
      }
      
      // Create variables for light mode
      const createdVariables: { [key: string]: Variable } = {};
      const allVariables = await figma.variables.getLocalVariablesAsync();
      
      for (const [varName, colorValue] of Object.entries(data.modes.light)) {
        let variable = allVariables.find(
          v => v.name === varName && v.variableCollectionId === collection.id
        );
        
        if (!variable) {
          variable = figma.variables.createVariable(
            varName,
            collection,
            'COLOR'
          );
        }
        
        createdVariables[varName] = variable;
        
        // Set light mode value
        const rgb = hexToRgb(colorValue as string);
        variable.setValueForMode(lightMode.modeId, rgb);
      }
      
      // Set dark mode values
      for (const [varName, colorValue] of Object.entries(data.modes.dark)) {
        const variable = createdVariables[varName];
        if (variable) {
          const rgb = hexToRgb(colorValue as string);
          variable.setValueForMode(darkMode.modeId, rgb);
        }
      }
      
      figma.ui.postMessage({
        type: 'import-complete',
        count: Object.keys(createdVariables).length,
        collectionName: collection.name
      });
      
     } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      figma.ui.postMessage({
        type: 'import-error',
        error: message
      });
    }
  } else if (msg.type === 'cancel') {
    figma.closePlugin();
  }
};

function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  };
}
