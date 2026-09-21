import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';

const app = express();
const port = Number(process.env.PORT || 4800);
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5180' }));
app.use(express.json({ limit: '24kb' }));

const sampleSchema = new mongoose.Schema(
  {
    sampleCode: {
      type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 24,
      match: [/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, 'Use letters, numbers, and single hyphens'],
    },
    siteAlias: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    collectorAlias: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    source: {
      type: String, required: true,
      enum: ['tap', 'well', 'river', 'lake', 'storage', 'other'],
    },
    sampledAt: {
      type: Date, required: true,
      validate: {
        validator: (value) => value <= new Date(Date.now() + 5 * 60 * 1000),
        message: 'Sample time cannot be in the future',
      },
    },
    ph: { type: Number, required: true, min: 0, max: 14 },
    turbidityNtu: { type: Number, required: true, min: 0, max: 1000 },
    chlorineMgL: { type: Number, required: true, min: 0, max: 20 },
    temperatureC: { type: Number, required: true, min: -10, max: 60 },
    notes: { type: String, required: true, trim: true, minlength: 5, maxlength: 300 },
  },
  { timestamps: true, versionKey: false }
);

const Sample = mongoose.model('WaterSample', sampleSchema);
const writable = new Set([
  'sampleCode', 'siteAlias', 'collectorAlias', 'source', 'sampledAt',
  'ph', 'turbidityNtu', 'chlorineMgL', 'temperatureC', 'notes',
]);
const asyncRoute = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};
const escapeRegex = (value) => value.replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&');

function classification(item) {
  if (item.ph < 6.5 || item.ph > 8.5 || item.turbidityNtu > 5 || item.chlorineMgL < 0.2 || item.chlorineMgL > 4) {
    return 'unsafe';
  }
  if (item.ph < 6.8 || item.ph > 8.2 || item.turbidityNtu > 1 || item.chlorineMgL < 0.5 || item.chlorineMgL > 3.5) {
    return 'attention';
  }
  return 'safe';
}

function present(sample) {
  const item = sample.toObject ? sample.toObject() : sample;
  return { ...item, classification: classification(item) };
}

app.get('/api/health', (_request, response) => response.json({ status: 'ok', service: 'water-watch' }));

app.get('/api/samples/metrics', asyncRoute(async (_request, response) => {
  const samples = await Sample.find().sort({ sampledAt: -1 }).limit(1000).lean();
  const metrics = { total: samples.length, safe: 0, attention: 0, unsafe: 0, averageTurbidity: 0 };
  let turbidityTotal = 0;
  samples.forEach((sample) => {
    metrics[classification(sample)] += 1;
    turbidityTotal += sample.turbidityNtu;
  });
  metrics.averageTurbidity = samples.length ? Number((turbidityTotal / samples.length).toFixed(2)) : 0;
  response.json(metrics);
}));

app.get('/api/samples', asyncRoute(async (request, response) => {
  const filter = {};
  const source = String(request.query.source || '');
  if (source) filter.source = source;
  const search = String(request.query.search || '').trim().slice(0, 80);
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ sampleCode: pattern }, { siteAlias: pattern }, { collectorAlias: pattern }];
  }
  const requestedClass = String(request.query.classification || '');
  const samples = await Sample.find(filter).sort({ sampledAt: -1 }).limit(200).lean();
  const result = samples.map(present).filter((item) => !requestedClass || item.classification === requestedClass);
  response.json(result);
}));

app.post('/api/samples', asyncRoute(async (request, response) => {
  const sample = await Sample.create(request.body);
  response.status(201).json(present(sample));
}));

app.patch('/api/samples/:id', asyncRoute(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Invalid sample id' });
  }
  const updates = Object.entries(request.body).filter(([key]) => writable.has(key));
  if (!updates.length) return response.status(400).json({ error: 'Provide a supported field' });
  const sample = await Sample.findById(request.params.id);
  if (!sample) return response.status(404).json({ error: 'Water sample not found' });
  updates.forEach(([key, value]) => { sample[key] = value; });
  await sample.save();
  return response.json(present(sample));
}));

app.delete('/api/samples/:id', asyncRoute(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Invalid sample id' });
  }
  const sample = await Sample.findByIdAndDelete(request.params.id);
  return sample
    ? response.status(204).end()
    : response.status(404).json({ error: 'Water sample not found' });
}));

app.use((_request, response) => response.status(404).json({ error: 'Route not found' }));
app.use((error, _request, response, _next) => {
  if (error.code === 11000) return response.status(409).json({ error: 'Sample code already exists' });
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
  .then(() => app.listen(port, () => console.log('WaterWatch API listening on ' + port)))
  .catch((error) => {
    console.error('MongoDB connection failed: ' + error.message);
    process.exit(1);
  });

