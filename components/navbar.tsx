import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";

import { MainNav } from "./main-nav";
import { ThemeToggle } from "./theme-toggle";

const Navbar = async () => {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="border-b bg-background">
      <MainNav>
        <div className="ml-auto flex shrink-0 items-center space-x-4">
          <ThemeToggle />
          <UserButton afterSignOutUrl="/" />
        </div>
      </MainNav>
    </div>
  );
};

export default Navbar;
