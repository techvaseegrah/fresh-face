import mongoose, {Schema, Document } from 'mongoose';

interface Product extends Document {
    name: string;
    price: number;
    description: string;
    stock: number;
}

const productSchema =new Schema<Product>({
    name: {type: String, required: true},
    price: {type: Number, required: true},
    description: {type: String, required:true},
    stock : {type: Number, required:true},
});

const Product = mongoose.models.Product || mongoose.model<Product>('Product', productSchema);
export default Product;