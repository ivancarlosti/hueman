var czrapp = czrapp || {};

/************************************************
* USER EXPERIENCE SUB CLASS
*************************************************/
(function($, czrapp) {
  var _methods =  {

        /*-----------------------------------------------------
        * MAIN
        ------------------------------------------------------*/
        stickify : function() {
              var self = this;
              this.stickyMenuWrapper      = false;
              this.stickyMenuDown         = new czrapp.Value( '_not_set_' );
              this.stickyHeaderThreshold  = 50;
              this.currentStickySelector  = new czrapp.Value( '' );//<= will be set on init and on resize
              this.hasStickyCandidate     = new czrapp.Value( false );
              this.stickyHeaderAnimating  = new czrapp.Value( false );

              //// SETUP LISTENERS ////
              //react to current sticky selector
              //will be set on init and reset on resize
              this.currentStickySelector.bind( function( to, from ) {
                    var _reset = function() {
                          czrapp.$_header.css( { 'height' : '' }).removeClass( 'fixed-header-on' );
                          self.stickyMenuDown( false );
                          self.stickyMenuWrapper = false;
                          self.hasStickyCandidate( false );
                    };

                    if ( ! _.isEmpty( to ) ) {
                          self.hasStickyCandidate( 1 == czrapp.$_header.find( to ).length );
                          //Does this selector actually exists ?
                          if ( ! self.hasStickyCandidate() ) {
                                _reset();
                          } else {
                                //cache the menu wrapper now
                                self.stickyMenuWrapper = czrapp.$_header.find( to );
                                //make sure we have the transition class in any cases
                                // + Always set the header height on dom ready
                                //=> will prevent any wrong value being assigned if menu is expanded before scrolling
                                czrapp.$_header.css( { 'height' : czrapp.$_header.height() }).addClass( 'fixed-header-on' );
                          }
                    } else {
                          _reset();
                    }
              });

              //Animate based on scroll position.
              //Must have a sticky candidate
              this.scrollPosition.bind( function( to, from ) {
                    if ( ! self.hasStickyCandidate() )
                      return;
                    //Set up only when scroll up is significant => avoid revealing the menu for minor scroll up actions on mobile devices
                    if ( Math.abs( to - from ) <= 5 )
                      return;
                    self.stickyMenuDown( to < from );
              });


              //czrapp.bind( 'page-scrolled-top', _mayBeresetTopPosition );
              var _maybeResetTop = function() {
                    if ( 'up' == self.scrollDirection() )
                        self._mayBeresetTopPosition();
              };
              czrapp.bind( 'scrolling-finished', _maybeResetTop );//react on scrolling finished <=> after the timer
              czrapp.bind( 'topbar-collapsed', _maybeResetTop );//react on topbar collapsed, @see topNavToLife

              //animate : make sure we don't hide the menu when too close from top
              self.stickyMenuDown.validate = function( value ) {
                    if ( ! self.hasStickyCandidate() )
                      return false;
                    if ( self.scrollPosition() < self.stickyHeaderThreshold && ! value ) {
                          if ( ! self.isScrolling() ) {
                                //print a message when attempt to programmatically hide the menu
                                czrapp.errorLog('Menu too close from top to be moved up');
                          }
                          return self.stickyMenuDown();
                    } else {
                          return value;
                    }
              };

              self.stickyMenuDown.bind( function( to, from, args ){
                    if ( ! _.isBoolean( to ) || ! self.hasStickyCandidate() ) {
                          return $.Deferred( function() { return this.resolve().promise(); } );
                    }

                    args = _.extend(
                          {
                                direction : to ? 'down' : 'up',
                                force : false,
                                menu_wrapper : self.stickyMenuWrapper,
                                fast : false
                          },
                          args || {}
                    );
                    return self._animate( { direction : args.direction, force : args.force, menu_wrapper : args.menu_wrapper, fast : args.fast } );
              }, { deferred : true } );


              /*-----------------------------------------------------
              * (real) RESIZE EVENT : refreshed every 50 ms
              ------------------------------------------------------*/
              self.isResizing.bind( function( is_resizing ) {
                    // if ( ! is_resizing )
                    //   return;
                    //reset the current sticky selector
                    self._setStickySelector();

                    if ( self.hasStickyCandidate() ) {
                          self.stickyMenuDown( self.scrollPosition() < self.stickyHeaderThreshold ,  { fast : true } ).done( function() {
                                czrapp.$_header.css( 'height' , '' ).removeClass( 'fixed-header-on' );
                                if ( self.hasStickyCandidate() ) {
                                      czrapp.$_header.css( 'height' , czrapp.$_header.height() ).addClass( 'fixed-header-on' );
                                }
                          });
                    } else {
                          self.stickyMenuDown( false ).done( function() {
                                $('#header').css( 'padding-top', '' );
                          });
                    }

                    //Adjust padding top if desktop sticky
                    if ( ! self._isMobile() ) {
                          self._adjustDesktopTopNavPaddingTop();
                    } else {
                          $('.full-width.topbar-enabled #header').css( 'padding-top', '' );
                          //Make sure the transform property is reset when swithing from desktop to mobile on resize
                          self._mayBeresetTopPosition();
                    }
              } );//resize();


              /*-----------------------------------------------------
              * INITIAL ACTIONS
              ------------------------------------------------------*/
              //Set initial sticky selector
              self._setStickySelector();


              //set fixed-header-on if is desktop because menu is already set to fixed position, we want to have the animation from the start
              // + Adjust padding top if desktop sticky
              if ( ! self._isMobile() && self.hasStickyCandidate() ) {
                    self._adjustDesktopTopNavPaddingTop();
              }

        },//stickify






        /*-----------------------------------------------------
        * STICKIFY HELPERS
        ------------------------------------------------------*/
        //@return void()
        //Is fired on first load and on resize
        //set the currentStickySelector observable Value()
        _setStickySelector : function() {
              var self = this,
                  stickyCandidatesMap = {
                        'only screen and (max-width: 719px)' : {
                              selector : 'mobile-sticky',
                              isOn : HUParams.sbStickyUserSettings && HUParams.menuStickyUserSettings.mobile
                        },
                        'only screen and (min-width: 720px)' : {
                              selector : 'desktop-sticky',
                              isOn : HUParams.sbStickyUserSettings && HUParams.menuStickyUserSettings.desktop
                        },
                  },
                  _match_ = false;

              // self.currentStickySelector = self.currentStickySelector || new czrapp.Value('');
              _.each( stickyCandidatesMap, function( _params, _layout ) {
                    if ( _.isFunction( window.matchMedia ) && matchMedia( _layout ).matches && _params.isOn ) {
                          _match_ = [ '.nav-container', _params.selector ].join('.');
                    }
              });
              self.currentStickySelector( _match_ );
        },


        //This is specific to Hueman
        _adjustDesktopTopNavPaddingTop : function() {
              var self = this;
              if ( ! self._isMobile() && self.hasStickyCandidate() ) {
                    $('.full-width.topbar-enabled #header').css( 'padding-top', czrapp.$_header.find( self.currentStickySelector() ).outerHeight() );
              } else {
                    $('#header').css( 'padding-top', '' );
              }
        },

        //RESET MOBILE HEADER TOP POSITION
        //@return void()
        //Make sure the header is visible when close to the top
        //Fired on each 'scrolling-finished' <=> user has not scrolled during 250 ms
        //+ 'up' == self.scrollDirection()
        _mayBeresetTopPosition : function() {
              var  self = this, $menu_wrapper = self.stickyMenuWrapper;
              //Bail if we are scrolling up
              if ( 'up' != self.scrollDirection() )
                return;
              //Bail if no menu wrapper
              //Or if we are already after the threshold
              //Or if we are scrolling down
              if ( ! $menu_wrapper.length )
                return;

              if ( self.scrollPosition() >= self.stickyHeaderThreshold )
                return;

              if ( ! self._isMobile() ) {
                  self._adjustDesktopTopNavPaddingTop();
              }

              //Always add this class => make sure the transition is smooth
              //czrapp.$_header.addClass( 'fixed-header-on' );
              self.stickyMenuDown( true, { force : true, fast : true } ).done( function() {
                    self.stickyHeaderAnimating( true );
                    ( function() {
                          return $.Deferred( function() {
                              var dfd = this;
                              _.delay( function() {
                                    if ( 'up' == self.scrollDirection() && self.scrollPosition() < 10) {
                                          $menu_wrapper.css({
                                                '-webkit-transform': '',   /* Safari and Chrome */
                                                '-moz-transform': '',       /* Firefox */
                                                '-ms-transform': '',        /* IE 9 */
                                                '-o-transform': '',         /* Opera */
                                                transform: ''
                                          });
                                    }
                                    self.stickyHeaderAnimating( false );
                                    dfd.resolve();
                              }, 10 );
                          }).promise();
                    } )().done( function() { });
              });
        },


        //args = { direction : up / down , force : false, menu_wrapper : $ element, fast : false }
        _animate : function( args ) {
              args = _.extend(
                    {
                          direction : 'down',
                          force : false,
                          menu_wrapper : {},
                          fast : false
                    },
                    args || {}
              );
              var dfd = $.Deferred(),
                  self = this,
                  $menu_wrapper = ! args.menu_wrapper.length ? czrapp.$_header.find( self.currentStickySelector() ) : args.menu_wrapper,
                  _startPosition = self.scrollPosition(),
                  _endPosition = _startPosition;

              //Bail here if we are still animating or if we don't have a menu element
              if ( ! $menu_wrapper.length )
                return;

              if ( ! czrapp.$_header.hasClass( 'fixed-header-on' ) ) {
                    czrapp.$_header.addClass( 'fixed-header-on' );
              }
              var _do = function() {
                    var translateYUp = $menu_wrapper.outerHeight(),
                        translateYDown = 0,
                        _translate;

                    if ( args.fast ) {
                          $menu_wrapper.addClass('fast');
                    }
                    //Handle the specific case of user logged in ( wpadmin bar length not false ) and previewing website with a mobile device < 600 px
                    //=> @media screen and (max-width: 600px)
                    // admin-bar.css?ver=4.7.3:1097
                    // #wpadminbar {
                    //     position: absolute;
                    // }
                    if ( _.isFunction( window.matchMedia ) && matchMedia( 'screen and (max-width: 600px)' ).matches && 1 == czrapp.$_wpadminbar.length ) {
                          //translateYUp = translateYUp + czrapp.$_wpadminbar.outerHeight();
                          translateYDown = translateYDown - $menu_wrapper.outerHeight();
                    }
                    _translate = 'up' == args.direction ? 'translate(0px, -' + translateYUp + 'px)' : 'translate(0px, -' + translateYDown + 'px)';
                    self.stickyHeaderAnimating( true );
                    self.stickyHeaderAnimationDirection = args.direction;
                    $menu_wrapper.toggleClass( 'sticky-visible', 'down' == args.direction );

                    $menu_wrapper.css({
                          //transform: 'up' == args.direction ? 'translate3d(0px, -' + _height + 'px, 0px)' : 'translate3d(0px, 0px, 0px)'
                          '-webkit-transform': _translate,   /* Safari and Chrome */
                          '-moz-transform': _translate,       /* Firefox */
                          '-ms-transform': _translate,        /* IE 9 */
                          '-o-transform': _translate,         /* Opera */
                          transform: _translate
                    });

                    _.delay( function() {
                          //Say it ain't so
                          self.stickyHeaderAnimating( false );
                          if ( args.fast ) {
                                $menu_wrapper.removeClass('fast');
                          }
                          dfd.resolve();
                    }, args.fast ? 100 : 350 );
              };//_do

              _.delay( function() {
                    //Is the menu expanded ?
                    var sticky_menu_id = _.isString( $menu_wrapper.attr('data-menu-id') ) ? $menu_wrapper.attr('data-menu-id') : '';
                    if ( czrapp.userXP.mobileMenu.has( sticky_menu_id ) ) {
                          czrapp.userXP.mobileMenu( sticky_menu_id )( 'collapsed' ).done( function() {
                                _do();
                          });
                    } else {
                          _do();
                    }
              }, 50 );
              return dfd.promise();
        }
  };//_methods{}

  czrapp.methods.UserXP = czrapp.methods.UserXP || {};
  $.extend( czrapp.methods.UserXP , _methods );

})(jQuery, czrapp);