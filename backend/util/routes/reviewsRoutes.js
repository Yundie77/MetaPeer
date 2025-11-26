const express = require('express');

const filesRoutes = require('./reviews/filesRoutes');
const commentsRoutes = require('./reviews/commentsRoutes');
const listRoutes = require('./reviews/listRoutes');
const tasksRoutes = require('./reviews/tasksRoutes');
const submitRoutes = require('./reviews/submitRoutes');
const metaRoutes = require('./reviews/metaRoutes');

const router = express.Router();

router.use(filesRoutes);
router.use(commentsRoutes);
router.use(listRoutes);
router.use(tasksRoutes);
router.use(submitRoutes);
router.use(metaRoutes);

module.exports = router;
