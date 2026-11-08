import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";

import {
    User,
    MapPin,
    Package,
    Heart,
    CreditCard,
    Settings,
    LogOut,
} from "lucide-react";

import { Merriweather } from "next/font/google";

const accountOptions = [
    {
        title: "Personal Information",
        description: "View your name and email",
        icon: User,
    },
    {
        title: "My Addresses",
        description: "Manage shipping address",
        icon: MapPin,
    },
    {
        title: "Order History",
        description: "View previous book orders",
        icon: Package,
    },
    {
        title: "Wishlist",
        description: "View your saved books",
        icon: Heart,
    },
    {
        title: "Payment Methods",
        description: "Manage your saved payment options",
        icon: CreditCard,
    },
    {
        title: "Account Settings",
        description: "Manage your account",
        icon: Settings,
    },
];

const merriweather = Merriweather({
    subsets: ["latin"],
    weight: ["400", "700"],
    display: "swap",
});

export default function UserLaunch() {

    return (
        <main className={`${merriweather.className} mx-auto w-full max-w-5xl p-6`}>

            {/* Account heading */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold">
                    My Account
                </h1>
                <p className="text-muted-foreground">
                    Manage your Book Worms account
                </p>
            </div>

            {/* Account navigation cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">

                {accountOptions.map((option) => {
                    const Icon = option.icon;

                    return (
                        <Card key={option.title}>
                            <CardHeader>
                                <Icon className="mb-2 h-6 w-6" />

                                <CardTitle>
                                    {option.title}
                                </CardTitle>

                                <CardDescription>
                                    {option.description}
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    );
                })}

            </div>

            {/* Sign out */}
            <div className="mt-8">
                <Button variant="destructive">
                    <LogOut className="h-4, w-4" />
                    Sign Out
                </Button>
            </div>

        </main>
    );
}