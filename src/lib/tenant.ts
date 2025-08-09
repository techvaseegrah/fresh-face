// src/lib/tenant.ts
import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Extracts the tenant ID from the request headers.
 * If the tenant ID is not found, it returns null.
 * Use this in your API routes to get the tenant ID.
 */
export function getTenantId(req: NextRequest): string | null {
  const tenantId = req.headers.get('x-tenant-id');
  return tenantId;
}

/**
 * A wrapper function that gets the tenant ID and immediately returns a 400 response if it's missing.
 * This reduces boilerplate code in your API handlers.
 */
export function getTenantIdOrBail(req: NextRequest): string | NextResponse {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) {
        // This should technically never happen if the middleware is configured correctly,
        // but it's a crucial safeguard.
        return NextResponse.json({ message: 'Tenant identification failed.' }, { status: 400 });
    }
    return tenantId;
}