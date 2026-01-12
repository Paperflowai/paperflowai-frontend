import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params;

    if (!orderId) {
      return NextResponse.json({ error: "Order ID required" }, { status: 400 });
    }

    const body = await request.json();
    const { itemId } = body;

    if (!itemId) {
      return NextResponse.json({ error: "itemId is required" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get order
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Get existing rows
    const currentData = order.data || {};
    const rows = currentData.rows || [];

    // Find item to approve
    const itemIndex = rows.findIndex((item: any) => item.id === itemId);

    if (itemIndex === -1) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Update item
    rows[itemIndex] = {
      ...rows[itemIndex],
      approved: true,
      approved_at: new Date().toISOString(),
      approved_by: userId,
    };

    // Update order data
    const updatedData = {
      ...currentData,
      rows,
    };

    // Save to database
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({ data: updatedData })
      .eq('id', orderId)
      .select()
      .single();

    if (updateError) {
      console.error('Database update error:', updateError);
      return NextResponse.json({ error: "Failed to approve item" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, item: rows[itemIndex], order: updatedOrder });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
