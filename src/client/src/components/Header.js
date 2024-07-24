export const Header = ({ title }) => (
  <div className="slds-page-header">
    <div className="slds-page-header__row">
      <div className="slds-page-header__col-title">
        <div className="slds-media">
          <div className="slds-media__body">
            <div className="slds-page-header__name">
              <div className="slds-page-header__name-title">
                <h1>
                  <span
                    className="slds-page-header__title slds-truncate"
                    title="E-Biles Manufacturing"
                  >
                    {title}
                  </span>
                </h1>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);
