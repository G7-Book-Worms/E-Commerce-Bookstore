import { eq } from "drizzle-orm";
import { db } from "../../index";
import { bookCategories, books } from "../../schema";

const categoryData = [
    { name: "Fiction", slug: "fiction" },
    { name: "Mystery", slug: "mystery" },
    { name: "Fantasy", slug: "fantasy" },
    { name: "Education", slug: "education" },
    { name: "Biography", slug: "biography" },
    { name: "Cookbooks", slug: "cookbooks" },
    { name: "Non-Fiction", slug: "non-fiction" },
];

type SeedBook = Omit<
    typeof books.$inferInsert,
    "bookId" | "catagoryId"
> & {
    categorySlug: string;
};

// Made up test books with identifiers.
const bookData: SeedBook[] = [
    {
        categorySlug: "fiction",
        isbn: "9780000000019",
        title: "The Last Bookshop",
        author: "Elena Brooks",
        description:
            "A young bookseller returns home to restore her family's bookstore.",
        priceCents: 1899,
        stock: 25,
        coverImageUrl: null,
    },
    {
        categorySlug: "mystery",
        isbn: "9780000000026",
        title: "The Midnight Letter",
        author: "Marcus Reed",
        description:
            "An unsigned letter leads a detective to a decades-old disappearance.",
        priceCents: 2499,
        stock: 3,
        coverImageUrl: null,
    },
    {
        categorySlug: "fantasy",
        isbn: "9780000000033",
        title: "Beyond the Silver Forest",
        author: "Nora Ellis",
        description:
            "An apprentice mapmaker discovers a hidden kingdom beyond the forest.",
        priceCents: 1599,
        stock: 0,
        coverImageUrl: null,
    },
    {
        categorySlug: "education",
        isbn: "9780000000040",
        title: "Statistics Made Simple",
        author: "Clara Bennett",
        description:
            "An introductory guide to probability, data analysis, and statistical reasoning with practical exercises.",
        priceCents: 3299,
        stock: 30,
        coverImageUrl: null,
    },
    {
        categorySlug: "education",
        isbn: "9780000000057",
        title: "Foundations of Computer Science",
        author: "Daniel Chen",
        description:
            "Explore algorithms, programming fundamentals, and computer systems through clear explanations and examples.",
        priceCents: 4599,
        stock: 18,
        coverImageUrl: null,
    },
    {
        categorySlug: "biography",
        isbn: "9780000000064",
        title: "A Life Among the Stars",
        author: "Maya Collins",
        description:
            "The story of a small-town student whose curiosity and determination led to a career in astronomy.",
        priceCents: 2299,
        stock: 14,
        coverImageUrl: null,
    },
    {
        categorySlug: "biography",
        isbn: "9780000000071",
        title: "Building Tomorrow",
        author: "James Whitaker",
        description:
            "A portrait of an engineer who dedicated her life to designing affordable housing for growing communities.",
        priceCents: 1999,
        stock: 4,
        coverImageUrl: null,
    },
    {
        categorySlug: "cookbooks",
        isbn: "9780000000088",
        title: "The Everyday Kitchen",
        author: "Sofia Martinez",
        description:
            "Simple recipes using affordable ingredients, with step-by-step instructions for everyday home cooking.",
        priceCents: 2499,
        stock: 22,
        coverImageUrl: null,
    },
    {
        categorySlug: "cookbooks",
        isbn: "9780000000095",
        title: "Baking for Beginners",
        author: "Oliver Hayes",
        description:
            "Learn to make breads, cookies, and cakes while mastering essential baking techniques.",
        priceCents: 2799,
        stock: 0,
        coverImageUrl: null,
    },
    {
        categorySlug: "non-fiction",
        isbn: "9780000000101",
        title: "The Science of Everyday Life",
        author: "Amelia Grant",
        description:
            "Discover the scientific principles behind familiar experiences, from brewing coffee to predicting the weather.",
        priceCents: 1899,
        stock: 35,
        coverImageUrl: null,
    },
    {
        categorySlug: "non-fiction",
        isbn: "9780000000118",
        title: "How Cities Grow",
        author: "Ethan Parker",
        description:
            "An accessible exploration of how transportation, housing, and local economies shape modern cities.",
        priceCents: 2199,
        stock: 9,
        coverImageUrl: null,
    },
];

export async function seedCatalogue() {
    await db.transaction(async (tx) => {
        const categoryIds = new Map<string, number>();

        // Categories must exist before books can reference them.
        for (const category of categoryData) {
            await tx
                .insert(bookCategories)
                .values(category)
                .onDuplicateKeyUpdate({
                    set: { name: category.name },
                });

            const [savedCategory] = await tx
                .select({ categoryId: bookCategories.categoryId })
                .from(bookCategories)
                .where(eq(bookCategories.slug, category.slug));

            if (!savedCategory) {
                throw new Error(`Category not found: ${category.slug}`);
            }

            categoryIds.set(category.slug, savedCategory.categoryId);
        }
        for (const book of bookData) {
            const { categorySlug, ...bookFields } = book;
            const categoryId = categoryIds.get(categorySlug);

            if (categoryId === undefined) {
                throw new Error(`Unknown category: ${categorySlug}`);
            }

            const values = {
                ...bookFields,
                categoryId,
            };

            await tx
                .insert(books)
                .values(values)
                .onDuplicateKeyUpdate({
                    set: values,
                });
        }
    });
    console.log(
        `Catalogue seeded: ${categoryData.length} categories, ` +
        `${bookData.length} books.`
    );
}