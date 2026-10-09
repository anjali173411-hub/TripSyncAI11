import mongoose from "mongoose";

const downloadSchema = new mongoose.Schema(
  {
    trip_id: {
      type: String,
      required: true,
    },

    user: {
      id: { type: Number, required: true },
      name: String,
      email: String,
    },

    trip: {
      destination: String,
      start_location: String,
      start_date: String,
      end_date: String,
      budget: Number,
      travellers: Number,
      status: String,
    },

    itinerary: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    file_name: {
      type: String,
      required: true,
    },

    pdf_data: {
      type: Buffer,
      required: true,
    },

    content_type: {
      type: String,
      default: "application/pdf",
    },

    download_count: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

downloadSchema.index({ trip_id: 1, "user.id": 1 }, { unique: true });

export const Download = mongoose.model("Download", downloadSchema);

export async function connectMongo() {
  if (mongoose.connection.readyState === 1) return;

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing in backend/.env");
  }

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });

  console.log("MongoDB connected (PDF downloads)");
}

export async function savePDF({ trip, user, itinerary, fileName, pdfData }) {
  await Download.findOneAndUpdate(
    { trip_id: trip.id, "user.id": user.id },
    {
      $set: {
        trip_id: trip.id,
        user: { id: user.id, name: user.name, email: user.email },
        trip: {
          destination: trip.destination,
          start_location: trip.start_location,
          start_date: trip.start_date,
          end_date: trip.end_date,
          budget: trip.budget,
          travellers: trip.travellers,
          status: trip.status,
        },
        itinerary: itinerary,
        file_name: fileName,
        pdf_data: pdfData,
        content_type: "application/pdf",
      },
      $inc: { download_count: 1 },
    },
    { upsert: true, new: true }
  );
}

export async function getPDF(tripId, userId) {
  return await Download.findOne({ trip_id: tripId, "user.id": userId });
}

export async function deletePDF(tripId) {
  await Download.deleteMany({ trip_id: tripId });
}
