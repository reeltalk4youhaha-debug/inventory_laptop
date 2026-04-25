import { useEffect, useState } from 'react'
import { inventoryApi } from './lib/api'

const navigationItems = [
  { page: 'Dashboard', label: 'Overview', icon: 'overview' },
  { page: 'Inventory', label: 'Laptops', icon: 'laptops' },
  { page: 'Reports', label: 'Insights', icon: 'insights' },
  { page: 'Profile', label: 'Account', icon: 'account' },
]
const BRAND_NAME = 'Herald Laptop Inventory'
const columns = ['Laptop', 'Category', 'SKU', 'Quantity', 'Description', 'Updates', 'Actions']
const PAGE_SIZE = 10
const SESSION_STORAGE_KEY = 'herald-laptop-inventory-session'
const SESSION_EMAIL_STORAGE_KEY = 'herald-laptop-admin-email'

const emptyProductForm = {
  name: '',
  category: '',
  sku: '',
  description: '',
  items: '',
  imageUrl: '',
  imageName: '',
}

const emptySignInForm = {
  email: '',
  password: '',
  rememberMe: false,
}

function getStoredSession() {
  if (typeof window === 'undefined') {
    return false
  }

  return (
    window.localStorage.getItem(SESSION_STORAGE_KEY) === 'active' ||
    window.sessionStorage.getItem(SESSION_STORAGE_KEY) === 'active'
  )
}

function getStoredSessionEmail() {
  if (typeof window === 'undefined') {
    return ''
  }

  return (
    window.localStorage.getItem(SESSION_EMAIL_STORAGE_KEY) ||
    window.sessionStorage.getItem(SESSION_EMAIL_STORAGE_KEY) ||
    ''
  )
}

function getStoredRememberPreference() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.localStorage.getItem(SESSION_STORAGE_KEY) === 'active'
}

function persistStoredSession(email, rememberMe) {
  if (typeof window === 'undefined') {
    return
  }

  const activeStorage = rememberMe ? window.localStorage : window.sessionStorage
  const inactiveStorage = rememberMe ? window.sessionStorage : window.localStorage

  inactiveStorage.removeItem(SESSION_STORAGE_KEY)
  inactiveStorage.removeItem(SESSION_EMAIL_STORAGE_KEY)
  activeStorage.setItem(SESSION_STORAGE_KEY, 'active')

  if (email) {
    activeStorage.setItem(SESSION_EMAIL_STORAGE_KEY, email)
  }
}

function clearStoredSession() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(SESSION_STORAGE_KEY)
  window.localStorage.removeItem(SESSION_EMAIL_STORAGE_KEY)
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
  window.sessionStorage.removeItem(SESSION_EMAIL_STORAGE_KEY)
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Unable to read image file.'))

    reader.readAsDataURL(file)
  })
}

function formatItemCount(value) {
  const amount = Number(value || 0)
  return `${amount} ${amount === 1 ? 'unit' : 'units'}`
}

function buildUpdateMessage({ previousProduct, nextValues, mode }) {
  if (mode === 'add') {
    return 'Recently added laptop'
  }

  if (!previousProduct) {
    return 'Laptop updated'
  }

  const updates = []
  const nextItems = Number(nextValues.items || 0)
  const previousItems = Number(previousProduct.items || 0)
  const itemDelta = nextItems - previousItems

  if (itemDelta !== 0) {
    updates.push(
      `${itemDelta > 0 ? '+' : ''}${itemDelta} ${Math.abs(itemDelta) === 1 ? 'unit' : 'units'} updated`,
    )
  }

  if (previousProduct.description.trim() !== nextValues.description.trim()) {
    updates.push('Description updated')
  }

  const previousImage = previousProduct.imageUrl.trim()
  const nextImage = nextValues.imageUrl.trim()

  if (previousImage && !nextImage) {
    updates.push('Image deleted')
  } else if (!previousImage && nextImage) {
    updates.push('Image added')
  } else if (previousImage !== nextImage) {
    updates.push('Image updated')
  }

  const detailsChanged =
    previousProduct.name.trim() !== nextValues.name.trim() ||
    previousProduct.category.trim() !== nextValues.category.trim() ||
    previousProduct.sku.trim() !== nextValues.sku.trim()

  if (!updates.length && detailsChanged) {
    updates.push('Laptop details updated')
  }

  if (!updates.length) {
    updates.push(previousProduct.updates || 'No recent changes')
  }

  return updates.slice(0, 2).join(' / ')
}

function filterProducts(products, searchQuery) {
  const keyword = searchQuery.trim().toLowerCase()

  if (!keyword) {
    return products
  }

  return products.filter((product) =>
    [
      product.name,
      product.category,
      product.sku,
      product.description,
      product.updates,
      String(product.items),
      formatItemCount(product.items),
    ]
      .join(' ')
      .toLowerCase()
      .includes(keyword),
  )
}

function getStockStatus(items) {
  const quantity = Number(items || 0)
  if (quantity <= 0) return 'Out of Stock'
  if (quantity <= 20) return 'Low Stock'
  return 'Healthy'
}

function getTotalPages(totalItems) {
  return Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
}

function paginateProducts(products, page) {
  const startIndex = (page - 1) * PAGE_SIZE
  return products.slice(startIndex, startIndex + PAGE_SIZE)
}

function App() {
  const [activePage, setActivePage] = useState('Dashboard')
  const [products, setProducts] = useState([])
  const [editor, setEditor] = useState({ open: false, mode: 'add', productId: null })
  const [formValues, setFormValues] = useState(emptyProductForm)
  const [isImageLoading, setIsImageLoading] = useState(false)
  const [isSavingProduct, setIsSavingProduct] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [viewTarget, setViewTarget] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [pageByView, setPageByView] = useState({ Dashboard: 1, Inventory: 1 })
  const [account, setAccount] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(getStoredSession)
  const [isAuthLoading, setIsAuthLoading] = useState(getStoredSession)
  const [isProductsLoading, setIsProductsLoading] = useState(false)
  const [productsError, setProductsError] = useState('')
  const [signInForm, setSignInForm] = useState(emptySignInForm)
  const [signInError, setSignInError] = useState('')
  const [rememberSession, setRememberSession] = useState(getStoredRememberPreference)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (isAuthenticated && account?.email) {
      persistStoredSession(account.email, rememberSession)
      return
    }

    if (!isAuthenticated) {
      clearStoredSession()
    }
  }, [account?.email, isAuthenticated, rememberSession])

  useEffect(() => {
    if (!isAuthenticated) {
      setIsAuthLoading(false)
      setAccount(null)
      setProducts([])
      return
    }

    let isCancelled = false

    async function bootstrap() {
      setIsAuthLoading(true)
      setIsProductsLoading(true)

      try {
        const storedAdminEmail = getStoredSessionEmail()
        const [profileResponse, productsResponse] = await Promise.all([
          inventoryApi.getProfile(storedAdminEmail),
          inventoryApi.getProducts(),
        ])

        if (isCancelled) return

        setAccount(profileResponse.user)
        setProducts(productsResponse.products || [])
        setProductsError('')
      } catch {
        if (!isCancelled) {
          setIsAuthenticated(false)
          setSignInError('Unable to restore your session. Please sign in again.')
          setProductsError('')
        }
      } finally {
        if (!isCancelled) {
          setIsAuthLoading(false)
          setIsProductsLoading(false)
        }
      }
    }

    bootstrap()

    return () => {
      isCancelled = true
    }
  }, [isAuthenticated])

  const filteredProducts = filterProducts(products, searchQuery)
  const dashboardTotalPages = getTotalPages(filteredProducts.length)
  const inventoryTotalPages = getTotalPages(filteredProducts.length)
  const dashboardPage = Math.min(pageByView.Dashboard, dashboardTotalPages)
  const inventoryPage = Math.min(pageByView.Inventory, inventoryTotalPages)
  const dashboardProducts = paginateProducts(filteredProducts, dashboardPage)
  const inventoryProducts = paginateProducts(filteredProducts, inventoryPage)

  const closeEditor = () => {
    setEditor({ open: false, mode: 'add', productId: null })
    setFormValues(emptyProductForm)
    setIsImageLoading(false)
    setIsSavingProduct(false)
  }

  const openAddModal = () => {
    setEditor({ open: true, mode: 'add', productId: null })
    setFormValues(emptyProductForm)
    setIsImageLoading(false)
  }

  const openEditModal = (product) => {
    setEditor({ open: true, mode: 'edit', productId: product.id })
    setFormValues({
      name: product.name,
      category: product.category,
      sku: product.sku,
      description: product.description,
      items: String(product.items),
      imageUrl: product.imageUrl,
      imageName: product.imageUrl ? `${product.name} image` : '',
    })
    setIsImageLoading(false)
  }

  const closeOverlays = () => {
    setDeleteTarget(null)
    setViewTarget(null)
    closeEditor()
  }

  const handleNavigate = (page) => {
    setActivePage(page)
    closeOverlays()
  }

  const handleProductFieldChange = (field, value) => {
    setFormValues((current) => ({ ...current, [field]: value }))
  }

  const handleImageSelect = async (file) => {
    if (!file) return

    setIsImageLoading(true)

    try {
      const imageUrl = await readFileAsDataUrl(file)

      setFormValues((current) => ({
        ...current,
        imageUrl,
        imageName: file.name,
      }))
    } finally {
      setIsImageLoading(false)
    }
  }

  const handleImageRemove = () => {
    setFormValues((current) => ({
      ...current,
      imageUrl: '',
      imageName: '',
    }))
  }

  const handleSearchChange = (value) => {
    setSearchQuery(value)
    setPageByView({ Dashboard: 1, Inventory: 1 })
  }

  const handlePageChange = (pageName, nextPage) => {
    setPageByView((current) => ({
      ...current,
      [pageName]: Math.max(1, nextPage),
    }))
  }

  const handleProductSubmit = async (event) => {
    event.preventDefault()

    if (isImageLoading || isSavingProduct) {
      return
    }

    const previousProduct =
      editor.mode === 'edit'
        ? products.find((product) => product.id === editor.productId) ?? null
        : null

    const payload = {
      name: formValues.name.trim(),
      category: formValues.category.trim(),
      sku: formValues.sku.trim(),
      description: formValues.description.trim(),
      items: Number(formValues.items),
      imageUrl: formValues.imageUrl.trim(),
      updates: buildUpdateMessage({ previousProduct, nextValues: formValues, mode: editor.mode }),
    }

    setIsSavingProduct(true)

    try {
      if (editor.mode === 'edit') {
        const response = await inventoryApi.updateProduct(editor.productId, payload)
        setProducts((current) =>
          current.map((product) => (product.id === editor.productId ? response.product : product)),
        )
      } else {
        const response = await inventoryApi.createProduct(payload)
        setProducts((current) => [response.product, ...current])
      }

      setProductsError('')
      closeEditor()
    } catch (error) {
      setProductsError(error.message)
      setIsSavingProduct(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    try {
      await inventoryApi.deleteProduct(deleteTarget.id)
      setProducts((current) => current.filter((product) => product.id !== deleteTarget.id))
      setProductsError('')
      setDeleteTarget(null)
    } catch (error) {
      setProductsError(error.message)
    }
  }

  const handleSignInFieldChange = (field, value) => {
    setSignInForm((current) => ({ ...current, [field]: value }))
    setSignInError('')
  }

  const handleSignIn = async (event) => {
    event.preventDefault()

    try {
      const response = await inventoryApi.login(signInForm)
      setAccount(response.user)
      setRememberSession(signInForm.rememberMe)
      setSignInForm(emptySignInForm)
      setSignInError('')
      setIsAuthenticated(true)
      setActivePage('Dashboard')
    } catch (error) {
      setSignInError(error.message)
    }
  }

  const handleSignOut = () => {
    setIsAuthenticated(false)
    setAccount(null)
    setProducts([])
    setProductsError('')
    setSearchQuery('')
    setPageByView({ Dashboard: 1, Inventory: 1 })
    setActivePage('Dashboard')
    closeOverlays()
  }

  const handleProfileSave = async ({ name, role, workspace }) => {
    const response = await inventoryApi.updateProfile({
      adminEmail: account?.email || getStoredSessionEmail(),
      name,
      role,
      workspace,
    })

    setAccount(response.user)
    return { ok: true, message: 'Profile details updated.' }
  }

  const handleEmailSave = async ({ email, currentPassword }) => {
    const response = await inventoryApi.updateEmail({
      adminEmail: account?.email || getStoredSessionEmail(),
      email,
      currentPassword,
    })

    setAccount(response.user)
    return { ok: true, message: 'Email updated successfully.' }
  }

  const handlePasswordSave = async ({ currentPassword, nextPassword }) => {
    await inventoryApi.updatePassword({
      adminEmail: account?.email || getStoredSessionEmail(),
      currentPassword,
      nextPassword,
    })

    return { ok: true, message: 'Password updated successfully.' }
  }

  const renderPage = () => {
    if (activePage === 'Inventory') {
      return (
        <CatalogPanel
          eyebrow="Laptops"
          title="Manage Laptop Records"
          description="Create, update, and remove laptop inventory records stored in your PostgreSQL database."
          products={inventoryProducts}
          totalCount={products.length}
          searchQuery={searchQuery}
          filteredCount={filteredProducts.length}
          currentPage={inventoryPage}
          totalPages={inventoryTotalPages}
          isLoading={isProductsLoading}
          errorMessage={productsError}
          onPreviousPage={() => handlePageChange('Inventory', inventoryPage - 1)}
          onNextPage={() => handlePageChange('Inventory', inventoryPage + 1)}
          manageMode
          actions={
            <button type="button" className="primary-button" onClick={openAddModal}>
              Add Laptop
            </button>
          }
          onEdit={openEditModal}
          onDelete={setDeleteTarget}
        />
      )
    }

    if (activePage === 'Reports') {
      return <ReportsPanel products={products} />
    }

    if (activePage === 'Profile' && account) {
      return (
        <ProfilePanel
          products={products}
          account={account}
          onProfileSave={handleProfileSave}
          onEmailSave={handleEmailSave}
          onPasswordSave={handlePasswordSave}
          onSignOut={handleSignOut}
        />
      )
    }

    return (
      <CatalogPanel
        eyebrow="Overview"
        title="Laptop Inventory Overview"
        description="This dashboard reflects the latest laptop records stored in your PostgreSQL inventory database."
        products={dashboardProducts}
        totalCount={products.length}
        searchQuery={searchQuery}
        filteredCount={filteredProducts.length}
        currentPage={dashboardPage}
        totalPages={dashboardTotalPages}
        isLoading={isProductsLoading}
        errorMessage={productsError}
        onPreviousPage={() => handlePageChange('Dashboard', dashboardPage - 1)}
        onNextPage={() => handlePageChange('Dashboard', dashboardPage + 1)}
        onView={setViewTarget}
      />
    )
  }

  if (isAuthLoading) {
    return <LoadingScreen message="Loading your laptop inventory..." />
  }

  if (!isAuthenticated) {
    return (
      <SignInScreen
        formValues={signInForm}
        error={signInError}
        onChange={handleSignInFieldChange}
        onSubmit={handleSignIn}
      />
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Brand />

          <div className="topbar-actions">
            <nav className="nav-tabs" aria-label="Primary navigation">
              {navigationItems.map((item) => (
                <button
                  key={item.page}
                  type="button"
                  className={item.page === activePage ? 'nav-button is-active' : 'nav-button'}
                  onClick={() => handleNavigate(item.page)}
                >
                  <NavIcon name={item.icon} />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>

            <HeaderSearch value={searchQuery} onChange={handleSearchChange} />
          </div>
        </div>
      </header>

      <section className="page-wrap">{renderPage()}</section>

      {editor.open ? (
        <ProductModal
          mode={editor.mode}
          formValues={formValues}
          onChange={handleProductFieldChange}
          onImageSelect={handleImageSelect}
          onImageRemove={handleImageRemove}
          onClose={closeEditor}
          onSubmit={handleProductSubmit}
          isImageLoading={isImageLoading}
          isSaving={isSavingProduct}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteModal
          product={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      ) : null}

      {viewTarget ? <ProductDetailsModal product={viewTarget} onClose={() => setViewTarget(null)} /> : null}
    </main>
  )
}

function LoadingScreen({ message }) {
  return (
    <main className="auth-shell auth-shell-loading">
      <section className="auth-card auth-card-loading">
        <div className="auth-copy">
          <p className="panel-kicker">Loading</p>
          <h1 className="auth-title">Connecting to {BRAND_NAME}</h1>
          <p className="auth-description">{message}</p>
        </div>
      </section>
    </main>
  )
}

function Brand({ auth = false }) {
  return (
    <div className={auth ? 'brand brand-auth' : 'brand'}>
      <div className={auth ? 'brand-mark brand-mark-auth' : 'brand-mark'} aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M6 6.5h12a1.5 1.5 0 0 1 1.5 1.5v7.5h-15V8A1.5 1.5 0 0 1 6 6.5z" />
          <path d="M3 17.5h18l-1.3 2H4.3L3 17.5z" />
          <path d="M9 15.5h6" />
        </svg>
      </div>
      <div className="brand-copy">
        <strong className={auth ? 'brand-title brand-title-auth' : 'brand-title'}>{BRAND_NAME}</strong>
        <span className="brand-subtitle">{auth ? 'Laptop inventory workspace' : 'Admin workspace'}</span>
      </div>
    </div>
  )
}

function NavIcon({ name }) {
  const icons = {
    overview: (
      <>
        <rect x="4" y="4" width="7" height="7" rx="1.5" />
        <rect x="13" y="4" width="7" height="7" rx="1.5" />
        <rect x="4" y="13" width="7" height="7" rx="1.5" />
        <rect x="13" y="13" width="7" height="7" rx="1.5" />
      </>
    ),
    laptops: (
      <>
        <path d="M5 6.5h14a1.5 1.5 0 0 1 1.5 1.5v8H3.5V8A1.5 1.5 0 0 1 5 6.5z" />
        <path d="M2.5 18.5h19" />
      </>
    ),
    insights: (
      <>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M8 15v-4" />
        <path d="M12 15V8" />
        <path d="M16 15v-6" />
      </>
    ),
    account: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="6" />
        <path d="M16 16l4 4" />
      </>
    ),
    signout: (
      <>
        <path d="M10 6H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4" />
        <path d="M14 8l4 4-4 4" />
        <path d="M18 12H9" />
      </>
    ),
  }

  return (
    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
      {icons[name]}
    </svg>
  )
}

function HeaderSearch({ value, onChange }) {
  return (
    <label className="header-search">
      <span className="sr-only">Search laptop inventory</span>
      <NavIcon name="search" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search laptops, SKU, category..."
      />
    </label>
  )
}

function PasswordInput({ value, onChange, placeholder, showPassword, onToggle, required = true }) {
  return (
    <div className="password-input-wrap">
      <input
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
      />
      <button type="button" className="password-visibility-toggle" onClick={onToggle}>
        <span className="sr-only">{showPassword ? 'Hide password' : 'Show password'}</span>
        {showPassword ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 3l18 18" />
            <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
            <path d="M9.9 4.3A9.7 9.7 0 0 1 12 4c5 0 8.5 4 10 8a13.5 13.5 0 0 1-3.1 4.6" />
            <path d="M6.6 6.6A13.5 13.5 0 0 0 2 12c1.5 4 5 8 10 8 1.4 0 2.7-.3 3.8-.8" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  )
}

function SignInScreen({ formValues, error, onChange, onSubmit }) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-copy">
          <Brand auth />
          <h1 className="auth-title">Sign in</h1>
          <p className="auth-description">Enter your admin account to continue.</p>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          <label className="form-field">
            Email
            <input
              type="email"
              value={formValues.email}
              onChange={(event) => onChange('email', event.target.value)}
              placeholder="Enter your email"
              required
            />
          </label>

          <label className="form-field">
            Password
            <PasswordInput
              value={formValues.password}
              onChange={(event) => onChange('password', event.target.value)}
              placeholder="Enter your password"
              showPassword={showPassword}
              onToggle={() => setShowPassword((current) => !current)}
            />
          </label>

          <label className="remember-field">
            <input
              type="checkbox"
              checked={formValues.rememberMe}
              onChange={(event) => onChange('rememberMe', event.target.checked)}
            />
            <span>Remember me</span>
          </label>

          {error ? <p className="form-feedback form-feedback-error">{error}</p> : null}

          <button type="submit" className="primary-button auth-submit">
            Sign In
          </button>
        </form>
      </section>
    </main>
  )
}

function CatalogPanel({
  eyebrow,
  title,
  description,
  products,
  totalCount,
  searchQuery,
  filteredCount,
  currentPage,
  totalPages,
  isLoading,
  errorMessage,
  onPreviousPage,
  onNextPage,
  actions = null,
  manageMode = false,
  onEdit = null,
  onDelete = null,
  onView = null,
}) {
  return (
    <section className="inventory-panel" aria-label={title}>
      {manageMode && (
        <div className="panel-toolbar">
          <div className="panel-copy">
            <p className="panel-kicker">{eyebrow}</p>
            <h1 className="panel-title">{title}</h1>
            <p className="panel-description">{description}</p>
          </div>
          {actions ? <div className="panel-actions">{actions}</div> : null}
        </div>
      )}

      {errorMessage ? <p className="panel-status panel-status-error">{errorMessage}</p> : null}

      {/* E-commerce Card View for Dashboard */}
      {!manageMode ? (
        <div className="catalog-container">
          {isLoading ? (
            <div className="empty-state">
              <strong>Loading laptop records from the database...</strong>
              <p>Your latest laptop inventory records are being fetched.</p>
            </div>
          ) : products.length ? (
            <>
              <div className="product-grid">
                {products.map((product) => (
                  <article key={product.id} className="product-card">
                    <div className="product-card-image">
                      <ProductImage name={product.name} imageUrl={product.imageUrl} />
                      <div className={`stock-badge stock-${getStockStatus(product.items).toLowerCase().replace(' ', '-')}`}>
                        {getStockStatus(product.items)}
                      </div>
                    </div>
                    <div className="product-card-content">
                      <h3 className="product-card-name">{product.name}</h3>
                      <p className="product-card-category">{product.category}</p>
                      <p className="product-card-sku">SKU: {product.sku}</p>
                      <div className="product-card-footer">
                        <span className="product-quantity">{formatItemCount(product.items)}</span>
                        <button
                          type="button"
                          className="product-card-button"
                          onClick={() => onView(product)}
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {filteredCount && !isLoading ? (
                <div className="pagination-footer">
                  <span className="pagination-status">
                    Page {currentPage} of {totalPages}
                  </span>
                  <div className="pagination-actions-centered">
                    <button
                      type="button"
                      className="pagination-button"
                      onClick={onPreviousPage}
                      disabled={currentPage === 1}
                    >
                      ← Prev
                    </button>
                    <button
                      type="button"
                      className="pagination-button"
                      onClick={onNextPage}
                      disabled={currentPage === totalPages}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="empty-state">
              <strong>{totalCount ? 'No matching laptops found.' : 'No laptop records in the database yet.'}</strong>
              <p>
                {totalCount
                  ? `Try a different search term or clear "${searchQuery}".`
                  : 'Use the Laptops page to add your first laptop record.'}
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Original Table View for Manage Mode */
        <div className="inventory-grid">
          <div className="inventory-header" role="row">
            {columns.map((column) => (
              <div key={column} className="inventory-heading" role="columnheader">
                {column}
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className="empty-state">
              <strong>Loading laptop records from the database...</strong>
              <p>Your latest laptop inventory records are being fetched.</p>
            </div>
          ) : products.length ? (
            <div className="inventory-body">
              {products.map((product) => (
                <article key={product.id} className="inventory-row" role="row">
                  <div className="inventory-cell product-cell" role="cell">
                    <ProductImage name={product.name} imageUrl={product.imageUrl} />
                    <div className="product-meta">
                      <strong>{product.name}</strong>
                      <span>{manageMode ? 'Saved in laptop inventory database' : 'Database snapshot'}</span>
                    </div>
                  </div>
                  <div className="inventory-cell" role="cell">
                    {product.category}
                  </div>
                  <div className="inventory-cell" role="cell">
                    {product.sku}
                  </div>
                  <div className="inventory-cell quantity-cell" role="cell">
                    {formatItemCount(product.items)}
                  </div>
                  <div className="inventory-cell description-cell" role="cell">
                    {product.description}
                  </div>
                  <div className="inventory-cell updates-cell" role="cell">
                    {product.updates}
                  </div>
                  <div className="inventory-cell" role="cell">
                    {manageMode ? (
                      <div className="action-group">
                        <button type="button" className="inline-button" onClick={() => onEdit(product)}>
                          Update
                        </button>
                        <button
                          type="button"
                          className="inline-button inline-button-danger"
                          onClick={() => onDelete(product)}
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="inline-button" onClick={() => onView(product)}>
                        View
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <strong>{totalCount ? 'No matching laptops found.' : 'No laptop records in the database yet.'}</strong>
              <p>
                {totalCount
                  ? `Try a different search term or clear "${searchQuery}".`
                  : 'Use the Laptops page to add your first laptop record.'}
              </p>
            </div>
          )}

          {filteredCount && !isLoading ? (
            <div className="table-footer">
              <span className="pagination-status">
                Page {currentPage} of {totalPages}
              </span>
              <div className="pagination-actions-centered">
                <button
                  type="button"
                  className="pagination-button"
                  onClick={onPreviousPage}
                  disabled={currentPage === 1}
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  className="pagination-button"
                  onClick={onNextPage}
                  disabled={currentPage === totalPages}
                >
                  Next →
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}

function ReportsPanel({ products }) {
  const totalItems = products.length
  const totalStock = products.reduce((sum, product) => sum + Number(product.items || 0), 0)
  const averageStock = totalItems ? Math.round(totalStock / totalItems) : 0
  const lowStockProducts = products.filter((product) => getStockStatus(product.items) === 'Low Stock')
  const outOfStockProducts = products.filter((product) => getStockStatus(product.items) === 'Out of Stock')
  const recentlyAddedItems = products.filter((product) =>
    product.updates.toLowerCase().includes('recently added'),
  )
  const highestStockProducts = [...products].sort((left, right) => right.items - left.items).slice(0, 4)
  const latestActivity = [...products].slice(0, 5)

  return (
    <section className="inventory-panel" aria-label="Reports">
      <div className="insights-header">
        <div className="insights-title-group">
          <p className="insights-kicker">📊 Analytics</p>
          <h1 className="insights-title">Inventory Insights</h1>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card metric-card-primary">
          <div className="metric-icon">📦</div>
          <div className="metric-content">
            <span className="metric-label">Total Models</span>
            <strong className="metric-value">{totalItems}</strong>
          </div>
        </div>
        <div className="metric-card metric-card-secondary">
          <div className="metric-icon">📈</div>
          <div className="metric-content">
            <span className="metric-label">Total Stock</span>
            <strong className="metric-value">{formatItemCount(totalStock)}</strong>
          </div>
        </div>
        <div className="metric-card metric-card-info">
          <div className="metric-icon">📋</div>
          <div className="metric-content">
            <span className="metric-label">Avg per Model</span>
            <strong className="metric-value">{formatItemCount(averageStock)}</strong>
          </div>
        </div>
        <div className="metric-card metric-card-accent">
          <div className="metric-icon">✨</div>
          <div className="metric-content">
            <span className="metric-label">Recently Added</span>
            <strong className="metric-value">{recentlyAddedItems.length}</strong>
          </div>
        </div>
      </div>

      <div className="insights-sections">
        <section className="insights-card">
          <div className="insights-card-header">
            <h2 className="insights-card-title">🏆 Top Stock Items</h2>
            <p className="insights-card-subtitle">Highest quantity laptops</p>
          </div>
          <div className="insights-card-content">
            {highestStockProducts.length ? (
              <div className="insights-list">
                {highestStockProducts.map((product, idx) => (
                  <div key={product.id} className="insights-list-item">
                    <div className="insights-rank">{idx + 1}</div>
                    <div className="insights-item-info">
                      <strong>{product.name}</strong>
                      <span className="insights-meta">{product.category}</span>
                    </div>
                    <div className="insights-item-value">{formatItemCount(product.items)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="insights-empty">No laptop records available yet.</p>
            )}
          </div>
        </section>

        <section className="insights-card insights-card-alert">
          <div className="insights-card-header">
            <h2 className="insights-card-title">⚠️ Stock Alerts</h2>
            <p className="insights-card-subtitle">Low and out of stock items</p>
          </div>
          <div className="insights-card-content">
            {[...lowStockProducts, ...outOfStockProducts].length ? (
              <div className="insights-alert-list">
                {[...lowStockProducts, ...outOfStockProducts].map((product) => (
                  <div key={product.id} className="insights-alert-item">
                    <div className="alert-status" data-status={getStockStatus(product.items).toLowerCase().replace(' ', '-')}>
                      {getStockStatus(product.items) === 'Low Stock' ? '⚠️' : '🚫'}
                    </div>
                    <div className="alert-info">
                      <strong>{product.name}</strong>
                      <span>{getStockStatus(product.items)} - {formatItemCount(product.items)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="insights-empty insights-empty-success">✓ No critical alerts</p>
            )}
          </div>
        </section>

        <section className="insights-card">
          <div className="insights-card-header">
            <h2 className="insights-card-title">📝 Recent Activity</h2>
            <p className="insights-card-subtitle">Latest laptop updates</p>
          </div>
          <div className="insights-card-content">
            {latestActivity.length ? (
              <div className="insights-activity-list">
                {latestActivity.map((product) => (
                  <div key={product.id} className="insights-activity-item">
                    <div className="activity-indicator" />
                    <div className="activity-info">
                      <strong>{product.name}</strong>
                      <span>{product.updates}</span>
                    </div>
                    <span className="activity-quantity">{formatItemCount(product.items)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="insights-empty">No activity yet.</p>
            )}
          </div>
        </section>
      </div>
    </section>
  )
}

function ProfilePanel({ products, account, onProfileSave, onEmailSave, onPasswordSave, onSignOut }) {
  const totalStock = products.reduce((sum, product) => sum + Number(product.items || 0), 0)
  const lowStockCount = products.filter((product) => getStockStatus(product.items) === 'Low Stock').length
  const outOfStockCount = products.filter((product) => getStockStatus(product.items) === 'Out of Stock').length
  const [usernameForm, setUsernameForm] = useState({
    username: account.name,
    currentPassword: '',
  })
  const [emailForm, setEmailForm] = useState({
    email: account.email,
    currentPassword: '',
  })
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    nextPassword: '',
    confirmPassword: '',
  })
  const [profileFeedback, setProfileFeedback] = useState(null)
  const [emailFeedback, setEmailFeedback] = useState(null)
  const [passwordFeedback, setPasswordFeedback] = useState(null)
  const [passwordVisibility, setPasswordVisibility] = useState({
    usernameCurrent: false,
    emailCurrent: false,
    passwordCurrent: false,
    passwordNext: false,
    passwordConfirm: false,
  })

  const togglePasswordVisibility = (field) => {
    setPasswordVisibility((current) => ({
      ...current,
      [field]: !current[field],
    }))
  }

  const handleUsernameSubmit = async (event) => {
    event.preventDefault()

    if (!usernameForm.username.trim() || !usernameForm.currentPassword) {
      setProfileFeedback({ tone: 'error', message: 'Enter username and current password.' })
      return
    }

    try {
      const result = await onProfileSave({ name: usernameForm.username, password: usernameForm.currentPassword })
      setProfileFeedback({ tone: result.ok ? 'success' : 'error', message: result.message })

      if (result.ok) {
        setUsernameForm((current) => ({ ...current, currentPassword: '' }))
      }
    } catch (error) {
      setProfileFeedback({ tone: 'error', message: error.message })
    }
  }

  const handleEmailSubmit = async (event) => {
    event.preventDefault()

    if (!emailForm.email.trim() || !emailForm.currentPassword) {
      setEmailFeedback({ tone: 'error', message: 'Enter email and current password.' })
      return
    }

    try {
      const result = await onEmailSave(emailForm)
      setEmailFeedback({ tone: result.ok ? 'success' : 'error', message: result.message })

      if (result.ok) {
        setEmailForm((current) => ({ ...current, currentPassword: '' }))
      }
    } catch (error) {
      setEmailFeedback({ tone: 'error', message: error.message })
    }
  }

  const handlePasswordSubmit = async (event) => {
    event.preventDefault()

    if (!passwordForm.currentPassword || !passwordForm.nextPassword || !passwordForm.confirmPassword) {
      setPasswordFeedback({ tone: 'error', message: 'Complete all password fields before saving.' })
      return
    }

    if (passwordForm.nextPassword.length < 4) {
      setPasswordFeedback({ tone: 'error', message: 'Use at least 4 characters for the new password.' })
      return
    }

    if (passwordForm.nextPassword !== passwordForm.confirmPassword) {
      setPasswordFeedback({ tone: 'error', message: 'New password and confirmation do not match.' })
      return
    }

    try {
      const result = await onPasswordSave(passwordForm)
      setPasswordFeedback({ tone: result.ok ? 'success' : 'error', message: result.message })

      if (result.ok) {
        setPasswordForm({
          currentPassword: '',
          nextPassword: '',
          confirmPassword: '',
        })
      }
    } catch (error) {
      setPasswordFeedback({ tone: 'error', message: error.message })
    }
  }

  return (
    <section className="inventory-panel" aria-label="Account">
      <div className="panel-toolbar">
        <div className="panel-copy">
          <p className="panel-kicker">⚙️ Account Management</p>
          <h1 className="panel-title">Manage Your Account</h1>
        </div>
        <button type="button" className="secondary-button profile-signout" onClick={onSignOut}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Sign Out</span>
        </button>
      </div>

      <section className="account-management-grid">
        <article className="account-info-card">
          <div className="account-info-header">
            <div className="account-info-avatar">👤</div>
            <div className="account-info-details">
              <h2>{account.name}</h2>
              <p>{account.email}</p>
              <span className="account-info-meta">Member since {account.memberSince}</span>
            </div>
          </div>
        </article>

        <article className="account-form-card">
          <div className="account-form-header">
            <p className="form-kicker">🔤 Username</p>
            <h3 className="form-title">Change Username</h3>
          </div>

          <form className="account-form" onSubmit={handleUsernameSubmit}>
            <div className="form-group">
              <label className="form-label">
                New Username
                <input
                  type="text"
                  value={usernameForm.username}
                  onChange={(event) => {
                    setUsernameForm((current) => ({ ...current, username: event.target.value }))
                    setProfileFeedback(null)
                  }}
                  placeholder="Enter new username"
                  required
                />
              </label>

              <label className="form-label">
                Current Password
                <PasswordInput
                  value={usernameForm.currentPassword}
                  onChange={(event) => {
                    setUsernameForm((current) => ({
                      ...current,
                      currentPassword: event.target.value,
                    }))
                    setProfileFeedback(null)
                  }}
                  placeholder="Enter your current password"
                  showPassword={passwordVisibility.usernameCurrent}
                  onToggle={() => togglePasswordVisibility('usernameCurrent')}
                />
              </label>
            </div>

            {profileFeedback ? (
              <p
                className={
                  profileFeedback.tone === 'success'
                    ? 'form-feedback form-feedback-success'
                    : 'form-feedback form-feedback-error'
                }
              >
                {profileFeedback.message}
              </p>
            ) : null}

            <button type="submit" className="form-submit-button">
              Update Username
            </button>
          </form>
        </article>

        <article className="account-form-card">
          <div className="account-form-header">
            <p className="form-kicker">📧 Email</p>
            <h3 className="form-title">Change Email Address</h3>
          </div>

          <form className="account-form" onSubmit={handleEmailSubmit}>
            <div className="form-group">
              <label className="form-label">
                New Email
                <input
                  type="email"
                  value={emailForm.email}
                  onChange={(event) => {
                    setEmailForm((current) => ({ ...current, email: event.target.value }))
                    setEmailFeedback(null)
                  }}
                  placeholder="Enter new email address"
                  required
                />
              </label>

              <label className="form-label">
                Current Password
                <PasswordInput
                  value={emailForm.currentPassword}
                  onChange={(event) => {
                    setEmailForm((current) => ({
                      ...current,
                      currentPassword: event.target.value,
                    }))
                    setEmailFeedback(null)
                  }}
                  placeholder="Enter your current password"
                  showPassword={passwordVisibility.emailCurrent}
                  onToggle={() => togglePasswordVisibility('emailCurrent')}
                />
              </label>
            </div>

            {emailFeedback ? (
              <p
                className={
                  emailFeedback.tone === 'success'
                    ? 'form-feedback form-feedback-success'
                    : 'form-feedback form-feedback-error'
                }
              >
                {emailFeedback.message}
              </p>
            ) : null}

            <button type="submit" className="form-submit-button">
              Update Email
            </button>
          </form>
        </article>

        <article className="account-form-card account-form-card-password">
          <div className="account-form-header">
            <p className="form-kicker">🔐 Security</p>
            <h3 className="form-title">Change Password</h3>
          </div>

          <form className="account-form" onSubmit={handlePasswordSubmit}>
            <div className="form-group">
              <label className="form-label">
                Current Password
                <PasswordInput
                  value={passwordForm.currentPassword}
                  onChange={(event) => {
                    setPasswordForm((current) => ({
                      ...current,
                      currentPassword: event.target.value,
                    }))
                    setPasswordFeedback(null)
                  }}
                  placeholder="Enter your current password"
                  showPassword={passwordVisibility.passwordCurrent}
                  onToggle={() => togglePasswordVisibility('passwordCurrent')}
                />
              </label>

              <label className="form-label">
                New Password
                <PasswordInput
                  value={passwordForm.nextPassword}
                  onChange={(event) => {
                    setPasswordForm((current) => ({ ...current, nextPassword: event.target.value }))
                    setPasswordFeedback(null)
                  }}
                  placeholder="Enter new password (min 4 characters)"
                  showPassword={passwordVisibility.passwordNext}
                  onToggle={() => togglePasswordVisibility('passwordNext')}
                />
              </label>

              <label className="form-label">
                Confirm Password
                <PasswordInput
                  value={passwordForm.confirmPassword}
                  onChange={(event) => {
                    setPasswordForm((current) => ({
                      ...current,
                      confirmPassword: event.target.value,
                    }))
                    setPasswordFeedback(null)
                  }}
                  placeholder="Confirm your new password"
                  showPassword={passwordVisibility.passwordConfirm}
                  onToggle={() => togglePasswordVisibility('passwordConfirm')}
                />
              </label>
            </div>

            {passwordFeedback ? (
              <p
                className={
                  passwordFeedback.tone === 'success'
                    ? 'form-feedback form-feedback-success'
                    : 'form-feedback form-feedback-error'
                }
              >
                {passwordFeedback.message}
              </p>
            ) : null}

            <button type="submit" className="form-submit-button">
              Update Password
            </button>
          </form>
        </article>
      </section>
    </section>
  )
}

function ProductImage({ name, imageUrl }) {
  if (imageUrl) {
    return (
      <div className="product-artwork">
        <img src={imageUrl} alt={name} />
      </div>
    )
  }

  return <div className="product-artwork product-artwork--placeholder">Laptop</div>
}

function ProductModal({
  mode,
  formValues,
  onChange,
  onImageSelect,
  onImageRemove,
  onClose,
  onSubmit,
  isImageLoading,
  isSaving,
}) {
  const isEditMode = mode === 'edit'

  return (
    <div className="modal-backdrop">
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
        <div className="modal-header">
          <div>
            <p className="panel-kicker">Laptops</p>
            <h2 id="product-modal-title" className="modal-title">
              {isEditMode ? 'Update Laptop' : 'Add Laptop'}
            </h2>
            <p className="modal-description">
              {isEditMode
                ? 'Update the selected laptop details.'
                : 'Create a new laptop record and save it to PostgreSQL.'}
            </p>
          </div>
        </div>

        <form className="modal-form" onSubmit={onSubmit}>
          <div className="form-grid">
            <label className="form-field">
              Laptop Model
              <input
                type="text"
                value={formValues.name}
                onChange={(event) => onChange('name', event.target.value)}
                required
              />
            </label>

            <label className="form-field">
              Category
              <input
                type="text"
                value={formValues.category}
                onChange={(event) => onChange('category', event.target.value)}
                required
              />
            </label>

            <label className="form-field">
              SKU
              <input
                type="text"
                value={formValues.sku}
                onChange={(event) => onChange('sku', event.target.value)}
                required
              />
            </label>

            <label className="form-field">
              Quantity
              <input
                type="number"
                min="0"
                value={formValues.items}
                onChange={(event) => onChange('items', event.target.value)}
                required
              />
            </label>

            <div className="form-field form-field--full">
              <span>Laptop Image</span>
              <div className="image-upload-field">
                <label className="file-input-button" htmlFor="product-image-upload">
                  <input
                    id="product-image-upload"
                    className="file-input"
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null
                      onImageSelect(file)
                      event.target.value = ''
                    }}
                  />
                  {formValues.imageUrl ? 'Replace Image' : 'Upload Image'}
                </label>

                <div className="image-upload-copy">
                  <strong>{isImageLoading ? 'Reading image...' : formValues.imageName || 'No image selected'}</strong>
                  <span>Use JPG, PNG, or WEBP files from your device.</span>
                </div>

                {formValues.imageUrl ? (
                  <button
                    type="button"
                    className="secondary-button secondary-button-muted"
                    onClick={onImageRemove}
                  >
                    Remove Image
                  </button>
                ) : null}
              </div>

              {formValues.imageUrl ? (
                <div className="image-upload-preview">
                  <ProductImage name={formValues.name || 'Laptop image'} imageUrl={formValues.imageUrl} />
                </div>
              ) : null}
            </div>

            <label className="form-field form-field--full">
              Description
              <textarea
                rows="4"
                value={formValues.description}
                onChange={(event) => onChange('description', event.target.value)}
                required
              />
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={isImageLoading || isSaving}>
              {isImageLoading
                ? 'Uploading Image...'
                : isSaving
                  ? 'Saving...'
                  : isEditMode
                    ? 'Save Changes'
                    : 'Add Laptop'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function DeleteModal({ product, onCancel, onConfirm }) {
  return (
    <div className="modal-backdrop">
      <section className="modal-card modal-card--compact" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
        <div className="modal-header">
          <div>
            <p className="panel-kicker">Laptops</p>
            <h2 id="delete-modal-title" className="modal-title">
              Delete Laptop
            </h2>
            <p className="modal-description">
              Remove <strong>{product.name}</strong> from the laptop inventory database?
            </p>
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="danger-button" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </section>
    </div>
  )
}

function ProductDetailsModal({ product, onClose }) {
  return (
    <div className="modal-backdrop">
      <section
        className="modal-card modal-card--details ecommerce-product-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-details-title"
      >
        <button
          type="button"
          className="modal-close-button"
          onClick={onClose}
          aria-label="Close product details"
        >
          ✕
        </button>

        <div className="ecommerce-product-container">
          <div className="ecommerce-product-visual">
            <div className="product-image-wrapper">
              <ProductImage name={product.name} imageUrl={product.imageUrl} />
              <div className={`stock-badge-large stock-${getStockStatus(product.items).toLowerCase().replace(' ', '-')}`}>
                {getStockStatus(product.items)}
              </div>
            </div>
          </div>

          <div className="ecommerce-product-info">
            <div className="product-header">
              <p className="product-kicker">Laptop Inventory</p>
              <h2 id="product-details-title" className="product-title">
                {product.name}
              </h2>
              <p className="product-category">{product.category}</p>
            </div>

            <div className="product-specs">
              <div className="spec-item">
                <span className="spec-label">SKU</span>
                <span className="spec-value">{product.sku}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Stock Level</span>
                <span className="spec-value spec-quantity">{formatItemCount(product.items)}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Latest Update</span>
                <span className="spec-value">{product.updates}</span>
              </div>
            </div>

            <div className="product-description-section">
              <h3>Description</h3>
              <p>{product.description}</p>
            </div>

            <div className="product-modal-actions">
              <button type="button" className="primary-button action-button" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default App
