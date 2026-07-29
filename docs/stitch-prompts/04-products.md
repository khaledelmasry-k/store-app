# Products Management - Google Stitch Prompt

## Project Goal
Create the Products Management interface for managing unlimited products within a tenant workspace. This extends the existing single-product flow to support multi-product catalog management with variants, inventory, media, and categorization.

## Design Style
- **Tenant-Centric Interface** - Product management tailored for individual business owners
- **Inventory-Focused** - Emphasis on stock levels, variants, and product organization
- **Multi-Product Support** - Extend from single product to unlimited products
- **Arabic RTL Support** - Full RTL interface with Saudi/Egyptian market features
- **Role-Based Access** - Interface customized based on user role within tenant
- **Responsive Design** - Comprehensive desktop interface with mobile supplemental access
- **Performance-Oriented** - Fast access to product data and bulk operations

## Layout Structure

### Header & Context
- **Product Management Title**:
  - "إدارة المنتجات" (Products Management)
  - Current product count and active/inactive status
  - Quick access to import/export functions
  - Search bar for product lookup

- **Action Bar**:
  - "إضافة منتج جديد" (Add New Product) - Primary button
  - "استيراد منتجات" (Import Products) - CSV/bulk import
  - "تصدير المنتجات" (Export Products) - Export current list
  - "تحديث المخزون" (Update Stock) - Bulk stock management

### Main Content Area

#### Product Catalog Table
- **Columns**: Product Name, SKU, Price, Old Price, Stock, Variants, Status, Category, Created Date, Actions
- **Search and Filter**:
  - Search by name, SKU, description
  - Filter by status (active/inactive)
  - Filter by category
  - Filter by stock level (in stock, low stock, out of stock)
  - Price range filter
- **Sorting**: Sort by name, price, stock, created date
- **Bulk Actions**:
  - Enable/Disable products
  - Delete products
  - Update prices
  - Update stock levels
  - Assign categories
- **Pagination**: 10/25/50/100 per page

#### Product Creation/Edit Form
- **Basic Information**:
  - Product name (Arabic)
  - Product description (rich text editor)
  - Product SKU
  - Category assignment
  - Brand (optional)
  - Tags (optional)

- **Pricing**:
  - Base price
  - Old price (for discounts)
  - Pricing tiers (bulk discounts)
  - Currency selection (SAR/EGP)

- **Variants**:
  - Color options (with color picker)
  - Size options
  - Variant stock levels
  - Variant-specific pricing (optional)

- **Media**:
  - Main product image upload
  - Gallery images (multiple)
  - Image ordering/drag-and-drop
  - Image preview thumbnails

- **Inventory**:
  - Stock management toggle
  - Low stock threshold
  - Track inventory by variant
  - Backorder settings

- **SEO**:
  - Meta title
  - Meta description
  - URL slug
  - SEO image

- **Visibility**:
  - Active/Inactive toggle
  - Featured product toggle
  - Store link visibility

#### Product Detail View
- **Product Information**:
  - Full product details
  - All variants and stock levels
  - Price history
  - Image gallery
  - Category and tags

- **Order History**:
  - Orders containing this product
  - Sales analytics
  - Revenue generated

- **Actions**:
  - Edit product
  - Duplicate product
  - Delete product
  - View store link

#### Category Management
- **Category List**:
  - Category name, product count, status
  - Parent/child relationships
  - Drag-and-drop reordering
  - Add/Edit/Delete categories

- **Category Details**:
  - Category name
  - Description
  - Parent category
  - Product count
  - SEO settings

### Right Sidebar/Panels

#### Quick Stats
- **Product Statistics**:
  - Total products
  - Active products
  - Inactive products
  - Low stock products
  - Out of stock products

- **Category Breakdown**:
  - Products per category
  - Category performance

#### Recent Activity
- **Product Activity**:
  - Recently added products
  - Recently updated products
  - Stock level changes

#### Import/Export
- **Import Options**:
  - CSV template download
  - File upload
  - Import progress
  - Error reporting

- **Export Options**:
  - Export all products
  - Export filtered products
  - Export format selection (CSV, Excel)

### Footer
- **Product Management Footer**:
  - Total product count
  - Active/Inactive counts
  - Current filter status
  - Quick navigation links

## Technical Requirements

### Functionality
1. **Product Management Components**:
   - Product catalog table with search and filtering
   - Product creation/edit form with rich text editor
   - Variant management interface
   - Image upload and gallery management
   - Category management
   - Bulk operations (enable, disable, delete, price update, stock update)
   - Import/export functionality (CSV)

2. **Advanced Features**:
   - Product duplication
   - Price history tracking
   - SEO optimization tools
   - Product tagging
   - Featured product management
   - Low stock alerts

3. **Inventory Management**:
   - Stock level tracking per variant
   - Low stock threshold alerts
   - Backorder management
   - Inventory adjustment logs

4. **Performance**:
   - Pagination for large product catalogs
   - Virtual scrolling for product lists
   - Image lazy loading
   - Search indexing

### Accessibility
1. **ARIA Attributes**:
   - Proper landmarks for product sections
   - Keyboard navigation for tables and forms
   - Focus management for modals and dialogs
   - Screen reader support for product data

2. **Visual Design**:
   - Clear information hierarchy for product data
   - Color coding for stock status (green=in stock, yellow=low stock, red=out of stock)
   - Responsive design for all devices
   - Consistent spacing and layout

3. **Performance**:
   - Fast loading of product data
   - Efficient filtering and search
   - Optimized image loading
   - Minimal page load times

### Integration
1. **Backend Integration**:
   - Product CRUD API endpoints
   - Category management APIs
   - Image upload endpoints
   - Bulk operation endpoints
   - Import/export endpoints

2. **Analytics Integration**:
   - Product performance tracking
   - Sales analytics per product
   - Inventory turnover rates
   - Revenue attribution

3. **Localization**:
   - Arabic product management interface
   - Local currency display (SAR/EGP)
   - Regional date and time formats
   - Cultural compliance

## Future-Ready Considerations
1. **Scalability**:
   - Architecture supports unlimited products
   - Database optimization for large catalogs
   - Caching for frequently accessed products
   - CDN for product images

2. **Extensibility**:
   - Plugin system for product types
   - Custom field and attribute support
   - Integration framework for ERP systems
   - API-first design for external integrations

3. **Technology Stack Readiness**:
   - Ready for headless commerce
   - Compatible with PIM systems
   - Prepared for AI-powered product recommendations
   - Ready for advanced search (Elasticsearch)

## Development Notes
1. **Primary Colors**: Use existing application colors (#FF9900, #131921, #FEBD69)
2. **Typography**: Plus Jakarta Sans for headings, Noto Sans Arabic for Arabic text
3. **Iconography**: Material Symbols for all UI elements
4. **Animation**: Subtle transitions for product actions
5. **Responsive Design**: Desktop-first with mobile supplemental access
6. **Backward Compatibility**: Existing single-product flow must continue working

## Documentation Requirements
1. Component documentation for product management sections
2. API endpoint documentation for product CRUD operations
3. Import/export format specifications
4. Category management guides
5. Inventory management best practices

---

*Document created: Google Stitch Prompt for Products Management*
*Version: 1.0*
*Status: READY FOR DEVELOPMENT*

**Update the existing project. Do NOT redesign existing screens. Do NOT remove components. Do NOT change navigation. Do NOT change business logic. Only create missing UI. Keep identical design language. Keep RTL. Keep responsiveness.**