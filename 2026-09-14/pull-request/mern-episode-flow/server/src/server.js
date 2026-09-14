import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';

const app = express();
const port = Number(process.env.PORT || 4500);
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5177' }));
app.use(express.json({ limit: '24kb' }));

const stages = ['pitch', 'scripting', 'recording', 'editing', 'scheduled', 'published'];
const episodeSchema = new mongoose.Schema(
  {
    episodeCode: {
      type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 24,
      match: [/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, 'Use letters, numbers, and single hyphens'],
    },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    showAlias: { type: String, required: true, trim: true, minlength: 2, maxlength: 70 },
    ownerAlias: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    guestAlias: { type: String, trim: true, maxlength: 80, default: '' },
    episodeNumber: { type: Number, required: true, min: 1, max: 99999, validate: Number.isInteger },
    format: { type: String, required: true, enum: ['solo', 'interview', 'panel', 'narrative', 'news'] },
    stage: { type: String, required: true, enum: stages, default: 'pitch' },
    durationMinutes: { type: Number, required: true, min: 1, max: 480 },
    recordingDate: { type: Date, required: true },
    releaseDate: { type: Date, required: true },
    productionNote: { type: String, required: true, trim: true, minlength: 8, maxlength: 320 },
  },
  { timestamps: true, versionKey: false }
);

episodeSchema.pre('validate', function validateDates(next) {
  if (this.recordingDate && this.releaseDate && this.recordingDate > this.releaseDate) {
    this.invalidate('releaseDate', 'Release date must be on or after recording date');
  }
  next();
});

const Episode = mongoose.model('Episode', episodeSchema);
const writable = new Set([
  'episodeCode', 'title', 'showAlias', 'ownerAlias', 'guestAlias', 'episodeNumber',
  'format', 'stage', 'durationMinutes', 'recordingDate', 'releaseDate', 'productionNote',
]);
const asyncRoute = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};
const escapeRegex = (value) => value.replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&');
const present = (episode) => {
  const item = episode.toObject ? episode.toObject() : episode;
  return {
    ...item,
    releaseOverdue: !['published'].includes(item.stage) && new Date(item.releaseDate) < new Date(),
  };
};

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'episode-flow' });
});

app.get('/api/episodes', asyncRoute(async (request, response) => {
  const filter = {};
  for (const key of ['stage', 'format']) {
    const value = String(request.query[key] || '');
    if (value) filter[key] = value;
  }
  const search = String(request.query.search || '').trim().slice(0, 80);
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [
      { title: pattern }, { episodeCode: pattern }, { showAlias: pattern },
      { ownerAlias: pattern }, { guestAlias: pattern },
    ];
  }
  const episodes = await Episode.find(filter).sort({ releaseDate: 1, episodeNumber: 1 }).limit(100).lean();
  response.json(episodes.map(present));
}));

app.get('/api/episodes/metrics', asyncRoute(async (_request, response) => {
  const [total, active, scheduled, published, duration] = await Promise.all([
    Episode.countDocuments(),
    Episode.countDocuments({ stage: { $in: ['scripting', 'recording', 'editing'] } }),
    Episode.countDocuments({ stage: 'scheduled' }),
    Episode.countDocuments({ stage: 'published' }),
    Episode.aggregate([{ $group: { _id: null, minutes: { $sum: '$durationMinutes' } } }]),
  ]);
  response.json({ total, active, scheduled, published, minutes: duration[0]?.minutes || 0 });
}));

app.post('/api/episodes', asyncRoute(async (request, response) => {
  const episode = await Episode.create(request.body);
  response.status(201).json(present(episode));
}));

app.patch('/api/episodes/:id', asyncRoute(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Invalid episode id' });
  }
  const updates = Object.entries(request.body).filter(([key]) => writable.has(key));
  if (!updates.length) return response.status(400).json({ error: 'Provide a supported field' });
  const episode = await Episode.findById(request.params.id);
  if (!episode) return response.status(404).json({ error: 'Episode not found' });
  updates.forEach(([key, value]) => { episode[key] = value; });
  await episode.save();
  return response.json(present(episode));
}));

app.delete('/api/episodes/:id', asyncRoute(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Invalid episode id' });
  }
  const episode = await Episode.findByIdAndDelete(request.params.id);
  return episode
    ? response.status(204).end()
    : response.status(404).json({ error: 'Episode not found' });
}));

app.use((_request, response) => response.status(404).json({ error: 'Route not found' }));
app.use((error, _request, response, _next) => {
  if (error.code === 11000) return response.status(409).json({ error: 'Episode code already exists' });
  if (error.name === 'ValidationError') {
    return response.status(400).json({
      error: 'Validation failed',
      details: Object.values(error.errors).map((item) => item.message),
    });
  }
  console.error(error);
  return response.status(500).json({ error: 'Unexpected server error' });
});

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is required. Copy .env.example to .env.');
  process.exit(1);
}
mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => app.listen(port, () => console.log('EpisodeFlow API listening on ' + port)))
  .catch((error) => {
    console.error('MongoDB connection failed: ' + error.message);
    process.exit(1);
  });

