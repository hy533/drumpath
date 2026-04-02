import { Router, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '../middleware/auth';

const CONCEPTS_DIR = path.resolve(process.cwd(), '..', 'docs', 'concepts');
const SLUG_RE = /^[a-z0-9-]+$/;

export function createConceptsRouter(): Router {
  const router = Router();

  router.get('/:slug', requireAuth, (req, res, next: NextFunction) => {
    const { slug } = req.params;

    if (!SLUG_RE.test(slug)) {
      res.status(400).json({ error: 'Invalid concept slug' });
      return;
    }

    const filePath = path.join(CONCEPTS_DIR, `${slug}.md`);

    fs.readFile(filePath, 'utf8', (err, content) => {
      if (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          res.status(404).json({ error: 'Concept not found' });
        } else {
          next(err);
        }
        return;
      }
      res.status(200).json({ content });
    });
  });

  return router;
}
