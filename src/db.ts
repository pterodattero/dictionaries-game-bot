import mongoose from "mongoose";

export default async () => {
    const dbUri = process.env.MONGO_DB;
    try {
        await mongoose.connect(dbUri as string);
        console.log('Connected to DB');
    }
    catch (error) {
        console.error('Failed to connect to DB: ', error);
    }
}