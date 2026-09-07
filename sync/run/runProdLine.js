const { runSync } = require('../orchestrator.js');

const config = require('../../config/ProdLine.config.js');

runSync(config, 'Product Line')
    .then(result => {
        console.log('Product Line sync result:', result);
        process.exit(0);
    })
    .catch(error => {
        console.error('Error during Product Line sync:', error);
        process.exit(1);
    });

