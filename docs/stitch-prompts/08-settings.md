# Settings - Google Stitch Prompt

## Project Goal
Create the Advanced Settings interface for platform configuration, store settings, user management, and integration configuration. This extends the existing settings page with comprehensive configuration options for the SaaS platform.

## Design Style
- **Configuration-Centric Interface** - Focus on platform and store configuration
- **Professional Settings Design** - Clean, organized settings with clear sections
- **Multi-Tenant Support** - Tenant-specific settings with platform-wide options
- **Arabic RTL Support** - Full RTL interface with Saudi/Egyptian market features
- **Role-Based Access** - Interface customized based on user role within tenant
- **Responsive Design** - Comprehensive desktop interface with mobile supplemental access
- **Performance-Oriented** - Fast access to settings and configuration

## Layout Structure

### Header & Context
- **Settings Title**:
  - "الإعدادات" (Settings)
  - Current section indicator
  - Quick access to help and documentation
  - Last saved timestamp

- **Action Bar**:
  - "حفظ الإعدادات" (Save Settings) - Primary button
  - "إلغاء" (Cancel) - Reset changes
  - "تصدير الإعدادات" (Export Settings) - Export configuration

### Main Navigation
- **Settings Sections**:
  - Store Settings
  - User Management
  - Integration Settings
  - Notification Settings
  - Security Settings
  - Billing Settings
  - Platform Settings (Super Admin only)

### Main Content Area

#### Store Settings
- **Store Information**:
  - Store name
  - Store tagline
  - Store logo upload
  - Primary color
  - Store description

- **Store Contact**:
  - Email address
  - Phone number
  - Address (governorate, city, detailed address)

- **Store Branding**:
  - Custom CSS (advanced)
  - Custom domain
  - Store favicon
  - Social media links

- **Store Preferences**:
  - Default currency
  - Default language
  - Timezone
  - Date format

#### User Management
- **Admin List**:
  - Table: Name, Email, Role, Status, Last Login, Actions
  - Search and filter
  - Add new admin button
  - Role assignment

- **Admin Details**:
  - Full name
  - Email address
  - Role assignment
  - Password change
  - Status (active/inactive)

- **Role Management**:
  - Role list with permissions
  - Create/edit roles
  - Permission assignment
  - Role hierarchy

- **Invitation Management**:
  - Pending invitations
  - Invite new users
  - Invitation expiration
  - Resend invitations

#### Integration Settings
- **Payment Gateways**:
  - Braintree configuration
  - Stripe configuration
  - PayPal configuration
  - Local payment methods
  - Test mode toggle

- **Shipping Providers**:
  - Carrier integration
  - Shipping rates
  - Tracking integration
  - Delivery areas

- **Marketing Integrations**:
  - Facebook Pixel
  - TikTok Pixel
  - Google Analytics
  - Meta Conversion API
  - WhatsApp Business API

- **Communication Channels**:
  - SMS provider
  - Email provider
  - WhatsApp integration
  - Push notifications

#### Notification Settings
- **Notification Types**:
  - Order notifications
  - Payment notifications
  - Stock alerts
  - System notifications

- **Notification Channels**:
  - Email
  - SMS
  - WhatsApp
  - Push notifications

- **Notification Rules**:
  - When to notify
  - Who to notify
  - Message templates
  - Schedule

#### Security Settings
- **Authentication**:
  - Password policy
  - Two-factor authentication
  - Session timeout
  - Login attempts

- **Data Protection**:
  - Data encryption
  - Backup settings
  - Data retention
  - GDPR compliance

- **Access Control**:
  - IP restrictions
  - Role-based permissions
  - Audit logging
  - API key management

#### Billing Settings
- **Subscription Plan**:
  - Current plan
  - Plan details
  - Usage limits
  - Upgrade options

- **Billing Information**:
  - Billing address
  - Tax information
  - Payment method
  - Invoice settings

- **Billing History**:
  - Past invoices
  - Payment history
  - Refund requests

#### Platform Settings (Super Admin Only)
- **Platform Configuration**:
  - Platform name
  - Platform logo
  - Default settings
  - Feature flags

- **Tenant Management**:
  - Tenant list
  - Tenant status
  - Tenant limits
  - Tenant settings

- **System Settings**:
  - Database configuration
  - Cache settings
  - Logging configuration
  - Maintenance mode

### Right Sidebar/Panels

#### Quick Actions
- **Common Operations**:
  - Save settings
  - Reset to defaults
  - Export settings
  - Import settings

#### Help & Documentation
- **Documentation Links**:
  - Settings guide
  - Integration guides
  - Troubleshooting
  - Support contact

#### Recent Changes
- **Settings History**:
  - Recent setting changes
  - Who made changes
  - When changes were made
  - Revert options

### Footer
- **Settings Footer**:
  - Current version
  - Last saved timestamp
  - Support contact
  - Quick navigation links

## Technical Requirements

### Functionality
1. **Settings Components**:
   - Settings navigation sidebar
   - Form-based settings sections
   - File upload for logos
   - Toggle switches for boolean settings
   - Color pickers for branding
   - Select dropdowns for options

2. **Advanced Features**:
   - Settings validation
   - Settings import/export
   - Settings history/audit trail
   - Role-based settings access
   - Settings templates

3. **Integration Configuration**:
   - API key management
   - Webhook configuration
   - OAuth setup
   - Test connection functionality

4. **Performance**:
   - Fast settings loading
   - Efficient settings saving
   - Settings caching
   - Minimal page load times

### Accessibility
1. **ARIA Attributes**:
   - Proper landmarks for settings sections
   - Keyboard navigation for forms
   - Focus management for modals and dialogs
   - Screen reader support for settings

2. **Visual Design**:
   - Clear information hierarchy for settings
   - Consistent form layout
   - Responsive design for all devices
   - Clear labels and descriptions

3. **Performance**:
   - Fast loading of settings
   - Efficient settings saving
   - Optimized form rendering
   - Minimal page load times

### Integration
1. **Backend Integration**:
   - Settings CRUD API endpoints
   - Integration configuration APIs
   - User management APIs
   - Role management APIs

2. **Analytics Integration**:
   - Settings usage analytics
   - Configuration change tracking
   - User behavior analysis

3. **Localization**:
   - Arabic settings interface
   - Local currency display (SAR/EGP)
   - Regional date and time formats
   - Cultural compliance

## Future-Ready Considerations
1. **Scalability**:
   - Architecture supports many settings
   - Database optimization for settings
   - Caching for frequently accessed settings
   - CDN for settings assets

2. **Extensibility**:
   - Plugin system for settings sections
   - Custom field and attribute support
   - Integration framework for third-party services
   - API-first design for external integrations

3. **Technology Stack Readiness**:
   - Ready for advanced configuration
   - Compatible with configuration management tools
   - Prepared for automated deployment
   - Ready for infrastructure as code

## Development Notes
1. **Primary Colors**: Use existing application colors (#FF9900, #131921, #FEBD69)
2. **Typography**: Plus Jakarta Sans for headings, Noto Sans Arabic for Arabic text
3. **Iconography**: Material Symbols for all UI elements
4. **Animation**: Subtle transitions for settings changes
5. **Responsive Design**: Desktop-first with mobile supplemental access
6. **Backward Compatibility**: Existing settings page must continue working

## Documentation Requirements
1. Component documentation for settings sections
2. API endpoint documentation for settings
3. Integration configuration guides
4. Role management documentation
5. Security best practices

---

*Document created: Google Stitch Prompt for Settings*
*Version: 1.0*
*Status: READY FOR DEVELOPMENT*

**Update the existing project. Do NOT redesign existing screens. Do NOT remove components. Do NOT change navigation. Do NOT change business logic. Only create missing UI. Keep identical design language. Keep RTL. Keep responsiveness.**