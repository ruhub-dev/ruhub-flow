// Backend availability must not prevent publishing the permanent frontend.
import {spawnSync} from 'node:child_process';
const result=spawnSync(process.execPath,['--test','tests/backend-runtime.test.mjs'],{stdio:'inherit'});process.exit(result.status||0);
