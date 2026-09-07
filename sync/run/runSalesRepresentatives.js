const { runSync } = require('../orchestrator.js');

const config = require('../../config/salesRepresentatives.config.js');
runSync(config, 'Sales Representatives')
    .then(result => {
        console.log('Sales Representatives sync result:', result);
        process.exit(0);
    })
    .catch(error => {
        console.error('Error during Sales Representatives sync:', error);
        process.exit(1);
    });
