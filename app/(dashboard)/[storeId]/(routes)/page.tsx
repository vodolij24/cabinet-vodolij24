import { redirect } from "next/navigation";

const StoreRootRedirect = async ({ params }: { params: Promise<{ storeId: string }> }) => {
  redirect(`/${ (await params).storeId}/sizes`);
};

export default StoreRootRedirect;
