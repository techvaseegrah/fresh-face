import mongoose,  {Document, Schema } from 'mongoose';

interface Stylist extends Document {
    name: string;
    experience : string;
    specialization :string;
    contactNumber: string;
    
}

const stylistSchema = new Schema <Stylist> ({
    name: {type: String, required: true},
    experience: {type: String, required: true},
    specialization: {type: String, required: true},
    contactNumber: {type:String, required: true},

});

const Stylist = mongoose.models.Stylist || mongoose.model<Stylist>('Stylist', stylistSchema);

export default Stylist;