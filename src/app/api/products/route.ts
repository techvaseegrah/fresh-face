import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";

//GET request to fetch all products
export async function GET () {
    await dbConnect();

    try {
        const products =await Product.find().sort({ name: 1});
        return NextResponse.json(products);
    } catch (error) {
        return NextResponse.json ({message: "Failed to fetch products"}, {status: 500});
    }
}

// POST request to add a new product
    export async function POST (request: Request) {
        await dbConnect();

        try {
            const body =await request.json();
            const {name, price, description, stock } = body;

            if (!name || !price || !description || !stock ) {
                return NextResponse.json({ message: "Name, price, description, and stock are required"}, {status:400})
            }

            const newProduct = new Product ({ name, price, description, stock });
            await newProduct.save();

            return NextResponse.json(newProduct, {status: 201});
        } catch (error) {
            return NextResponse.json({ message: "Failed to add product"}, {status: 500});
        }
    }
        // PUT request to update a product
        export async function PUT (request: Request) {
            await dbConnect ();        
       
        try {
            const body = await request.json();
            const {id, name, price, description, stock }= body;

            if (!id || !name || !price || !description || !stock) {
                return NextResponse.json ({ message: "ID, name, price, descrioption and stock are required"},{status: 400});
            }

            const updatedProduct = await Product.findByIdAndUpdate(id, {name, price, description, stock}, {new: true});

            if(!updatedProduct) {
               return NextResponse.json ({message: "Product not found"}, {status:404});
            }
            return NextResponse.json(updatedProduct);
        } catch (error) {
            return NextResponse.json({message: "Failed to update product"},{status:500});
        }
    }    
        //DELETE request to a delete a product
        export async function DELETE(request: Request){

            await dbConnect();
            try {
                const { searchParams } = new URL (request.url);
                const id = searchParams.get("id");

                if (!id) {
                    return NextResponse.json({message: "ID is required"}, {status: 400});
                }
                 const deleteProduct = await Product.findByIdAndDelete(id);
                 if (!deleteProduct) {
                    return NextResponse.json ({message: "Product not found "}, {status:404});
                 }

                 return NextResponse.json({message: "Product deleted"});
            } catch (error) {

                return NextResponse.json ({message:"Failed to delete product"}, {status:500});
            }
        }