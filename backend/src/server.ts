import dotenv from 'dotenv';

dotenv.config();

import { db } from './db/client';
import { createApp } from './app';

const port = parseInt(process.env.PORT ?? '3001', 10);

const app = createApp(db);

app.listen(port, () => {
  console.log(`Drumpath backend listening on port ${port}`);
});
