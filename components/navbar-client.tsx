"use client";

import { UserButton } from "@clerk/nextjs";
import StoreSwitcher from "@/components/store-switcher";
import { MainNav } from "@/components/main-nav";
import { ThemeToggle } from "@/components/theme-toggle";

interface Store {
  id: string;
  name: string;
  // add other fields if necessary
}

interface NavbarClientProps {
  stores: Store[];
}

export const NavbarClient = ({ stores }: NavbarClientProps) => {
  return ( 
    <div className="border-b">
      <div className="flex h-16 items-center px-4">
        
      
        <div className="ml-auto flex items-center space-x-4">
          <ThemeToggle />
          <UserButton  />
        </div>
      </div>
    </div>
  );
};
