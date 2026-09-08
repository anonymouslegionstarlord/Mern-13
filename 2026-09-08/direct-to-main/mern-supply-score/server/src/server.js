import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';

const app = express();
const port = Number(process.env.PORT || 4200);
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5174' }));
app.use(express.json({ limit: '24kb' }));

const categories = ['materials', 'logistics', 'software', 'facilities', 'professional-services', 'other'];
const statuses = ['active', 'approved', 'watch', 'paused'];
const risks = ['low', 'medium', 'high'];

const reviewSchema = new mongoose.Schema(
  {
    vendorCode: {
      type: String, required: true, unique: true, trim: true, uppercase: true, maxlength: 20,
      match: [/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, 'Use letters, numbers, and single hyphens'],
    },
    vendorAlias: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    category: { type: String, required: true, enum: categories },
    deliveryScore: { type: Number, required: true, min: 1, max: 5 },
    qualityScore: { type: Number, required: true, min: 1, max: 5 },
    communicationScore: { type: Number, required: true, min: 1, max: 5 },
    riskLevel: { type: String, required: true, enum: risks },
    status: { type: String, required: true, enum: statuses, default: 'active' },
    reviewDate: { type: Date, required: true },
    summary: { type: String, required: true, trim: true, minlength: 8, maxlength: 320 },
  },
  { timestamps: true, versionKey: false }
);

const Review = mongoose.model('Review', reviewSchema);
const writable = new Set([
  'vendorCode', 'vendorAlias', 'category', 'deliveryScore', 'qualityScore',
  'communicationScore', 'riskLevel', 'status', 'reviewDate', 'summary',
]);
const asyncRoute = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const present = (review) => {
  const item = review.toObject ? review.toObject() : review;
  return { ...item, averageScore: Number(((item.deliveryScore + item.qualityScore + item.communicationScore) / 3).toFixed(1)) };
};

app.get('/api/health', (_request, response) => response.json({ status: 'ok', service: 'supply-score' }));

app.get('/api/reviews', asyncRoute(async (request, response) => {
  const filter = {};
  for (const key of ['category', 'status', 'riskLevel']) {
    const value = String(request.query[key] || '');
    if (value) filter[key] = value;
  }
  const search = String(request.query.search || '').trim().slice(0, 80);
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ vendorCode: pattern }, { vendorAlias: pattern }];
  }
  const reviews = await Review.find(filter).sort({ reviewDate: -1, vendorAlias: 1 }).limit(100).lean();
  response.json(reviews.map(present));
}));

app.get('/api/reviews/metrics', asyncRoute(async (_request, response) => {
  const [total, watch, highRisk, scores] = await Promise.all([
    Review.countDocuments(), Review.countDocuments({ status: 'watch' }),
    Review.countDocuments({ riskLevel: 'high' }),
    Review.aggregate([{ $group: {
      _id: null,
      delivery: { $avg: '$deliveryScore' }, quality: { $avg: '$qualityScore' },
      communication: { $avg: '$communicationScore' },
    } }]),
  ]);
  const score = scores[0] || {};
  const round = (value) => Number((value || 0).toFixed(1));
  response.json({ total, watch, highRisk, delivery: round(score.delivery), quality: round(score.quality), communication: round(score.communication) });
}));

app.post('/api/reviews', asyncRoute(async (request, response) => {
  const review = await Review.create(request.body);
  response.status(201).json(present(review));
}));

app.patch('/api/reviews/:id', asyncRoute(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(400).json({ error: 'Invalid review id' });
  const updates = Object.entries(request.body).filter(([key]) => writable.has(key));
  if (!updates.length) return response.status(400).json({ error: 'Provide a supported field' });
  const review = await Review.findById(request.params.id);
  if (!review) return response.status(404).json({ error: 'Review not found' });
  updates.forEach(([key, value]) => { review[key] = value; });
  await review.save();
  return response.json(present(review));
}));

app.delete('/api/reviews/:id', asyncRoute(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(400).json({ error: 'Invalid review id' });
  const review = await Review.findByIdAndDelete(request.params.id);
  return review ? response.status(204).end() : response.status(404).json({ error: 'Review not found' });
}));

app.use((_request, response) => response.status(404).json({ error: 'Route not found' }));
app.use((error, _request, response, _next) => {
  if (error.code === 11000) return response.status(409).json({ error: 'Vendor code already exists' });
  if (error.name === 'ValidationError') {
    return response.status(400).json({ error: 'Validation failed', details: Object.values(error.errors).map((item) => item.message) });
  }
  console.error(error);
  return response.status(500).json({ error: 'Unexpected server error' });
});

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is required. Copy .env.example to .env.');
  process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => app.listen(port, () => console.log(`SupplyScore API listening on ${port}`)))
  .catch((error) => {
    console.error(`MongoDB connection failed: ${error.message}`);
    process.exit(1);
  });
