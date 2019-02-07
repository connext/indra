[33mcommit 43f5859d9ad20a8b70f80e11d1bc9cb5fd01911a[m[33m ([m[1;36mHEAD -> [m[1;32m149-thread-controllers[m[33m)[m
Author: arjunbhuptani <arjunbhuptani@gmail.com>
Date:   Thu Feb 7 08:01:51 2019 -0800

    Revert "getLastThreadUpdateId lib file (rename)"
    
    This reverts commit df3d26eb774bd5f54a3966ad178705e5a662e314.

[33mcommit fa9a9848e4148ede9524af8e784caccd34501312[m
Author: arjunbhuptani <arjunbhuptani@gmail.com>
Date:   Thu Feb 7 05:12:34 2019 -0800

    signed initialThreadStates in validator

[33mcommit 4582a65bcae44c9320aab243785125abac8a84e0[m
Author: arjunbhuptani <arjunbhuptani@gmail.com>
Date:   Thu Feb 7 05:11:41 2019 -0800

    stored thread states should always be SIGNED. Updated generateRootHash to conver to unsigned

[33mcommit f133bb95255b6a9255c8940c0e9372f7bb31bfdb[m
Author: arjunbhuptani <arjunbhuptani@gmail.com>
Date:   Thu Feb 7 04:53:42 2019 -0800

    state generator fixes

[33mcommit df3d26eb774bd5f54a3966ad178705e5a662e314[m
Author: arjunbhuptani <arjunbhuptani@gmail.com>
Date:   Thu Feb 7 04:15:58 2019 -0800

    getLastThreadUpdateId lib file (rename)

[33mcommit 049958ccfeb95f42965730d7e9685788f7f13ae2[m
Author: arjunbhuptani <arjunbhuptani@gmail.com>
Date:   Thu Feb 7 04:15:23 2019 -0800

    openThread happy case test firstpass + global lastThreadUpdateId fix + mocks fixes -- builds!

[33mcommit 2b6d1c7a5b0f8480bdafe1380f6648d3eada0369[m[33m ([m[1;31morigin/149-thread-controllers[m[33m)[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Wed Feb 6 22:38:51 2019 -0700

    initial thread buy controller logic

[33mcommit 9bf1af6079e585c0f4ea4bf775f7351a419f896f[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Wed Feb 6 22:31:40 2019 -0700

    fix args

[33mcommit 7d22eb7f87e32840fd0fb603daea812603eb7026[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Wed Feb 6 22:31:37 2019 -0700

    helper

[33mcommit 5961f945188f2cadd721b1b35d48211a55e024ed[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Wed Feb 6 22:31:31 2019 -0700

    return channel state

[33mcommit f9fded43d5306e1951fbf9c6e21239fd91138187[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Wed Feb 6 21:15:37 2019 -0700

    fix open/close

[33mcommit f56731e5f670205939c56293c90b025fc9816530[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Wed Feb 6 21:15:30 2019 -0700

    thread history and rename some store parameters

[33mcommit 383d5f4e68aa7d471c7672cfcf4f19b85b72c3d2[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Wed Feb 6 21:15:13 2019 -0700

    add thread history item

[33mcommit f2507dd3e4d75133f95f37103625134a4ae692f0[m
Author: arjunbhuptani <arjunbhuptani@gmail.com>
Date:   Wed Feb 6 11:11:29 2019 -0800

    minor notes + threadcontroller test + removing a couple of Reb-36 errors

[33mcommit 692de03abcb322349a26d3fd8a950750b7bec961[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Tue Feb 5 20:55:25 2019 -0700

    closeThread initial implementation

[33mcommit ebe5aa8fb3ed8842564cd1e8a55d5cc9a4fd47bc[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Tue Feb 5 20:18:18 2019 -0700

    join thread logic should go in state update controller, add comments

[33mcommit 78d15f0f1a98efa0d98aabd44520715976b2e676[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Tue Feb 5 20:17:54 2019 -0700

    track last thread update id in store

[33mcommit a2ce3b05c6d6cedce526dc0c2d137e4286465428[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Tue Feb 5 20:01:26 2019 -0700

    start controller

[33mcommit 9a10f889d8baadbd0945f408ee4f81e17e657e92[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Tue Feb 5 20:01:20 2019 -0700

    sign thread state, type fixes

[33mcommit 3c404bbb9cc0bbf6a3e749f9c7aa05607ad35166[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Tue Feb 5 20:00:07 2019 -0700

    pass around signed states

[33mcommit d65eea39124737333d96764d69dae9e9dc7938bc[m[33m ([m[1;31morigin/master[m[33m, [m[1;31morigin/HEAD[m[33m)[m
Merge: 3374158 3575a17
Author: Rahul Sethuram <rksethuram9@gmail.com>
Date:   Mon Feb 4 16:19:28 2019 -0800

    Merge pull request #74 from ConnextProject/devops
    
    Small Devops Tweaks

[33mcommit 3575a17022207d046f0a5d7e7ff743e896f09c2a[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sat Feb 2 18:40:43 2019 +0530

    readme: fix links & quiet warning

[33mcommit ec80f89a07f1e0d90ee13eb68242ebd6506845c5[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sat Feb 2 17:12:55 2019 +0530

    wallet: use modules/client instead of npm package

[33mcommit fe410ee74c4d0f200e3a401e30a7fd72b326809c[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sat Feb 2 16:34:37 2019 +0530

    ops: run-time tweaks

[33mcommit ac73e43d0d4fc19aeab3b7ea019272f09d328e07[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sat Feb 2 16:27:39 2019 +0530

    ops: build-time tweaks

[33mcommit 5986cc07f9ce49b136c4978fb52c7055ea6e23e6[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sat Feb 2 16:13:33 2019 +0530

    commit modules/client (not as submodule)

[33mcommit 337415852652e022559f9bcdeafb6ac2ff242c1b[m[33m ([m[1;32mmaster[m[33m)[m
Merge: ed4f733 9297b87
Author: Rahul Sethuram <rksethuram9@gmail.com>
Date:   Wed Jan 30 19:16:08 2019 -0800

    Merge pull request #73 from base0010/gk
    
    copy&pastable now

[33mcommit 9297b8799a5652b9fc3788e2c174ebd1826a047e[m
Author: Marcus H <marcus@gatekeeper.network>
Date:   Wed Jan 30 22:05:01 2019 -0500

    copy&pastable now

[33mcommit ed4f733fdf2efe039c716c1b0158685c787d59e9[m[33m ([m[1;31morigin/release/v1.0[m[33m, [m[1;32mrelease/v1.0[m[33m)[m
Merge: 5746eca e5d0d67
Author: Rahul Sethuram <rksethuram9@gmail.com>
Date:   Tue Jan 29 13:24:48 2019 -0800

    Merge pull request #72 from ConnextProject/hh-ux
    
    Merge branch for release.

[33mcommit e5d0d67b9e5fdfd2dc61259ad6a94a176ec950d5[m
Merge: 4c0980e e2548c7
Author: arjunbhuptani <arjunbhuptani@gmail.com>
Date:   Tue Jan 29 11:09:01 2019 -0800

    Merge branch 'hh-ux' of github.com:ConnextProject/indra into hh-ux

[33mcommit 4c0980e74c3db6bc7b75e9bd74a682bf4e2bc3a5[m
Author: arjunbhuptani <arjunbhuptani@gmail.com>
Date:   Tue Jan 29 11:05:59 2019 -0800

    color updates

[33mcommit e2548c7749a7ee9fdbf2187b91debcd794c9ae01[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Tue Jan 29 10:11:55 2019 -0800

    Fix deprecation warning

[33mcommit f306f27cd2fd86ee5d76f1560e84e85e8bb52a58[m
Merge: 96de59f 1ede16a
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Tue Jan 29 12:07:09 2019 -0500

    metamask auth modal

[33mcommit 96de59f8ed182a4aedd4653b9b1f4b12ac2e6c6c[m
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Tue Jan 29 12:04:58 2019 -0500

    wallet refresh and metamask signer

[33mcommit 1ede16afd93a15a7b507dcfe7c5a99e3dabafc68[m
Author: arjunbhuptani <arjunbhuptani@gmail.com>
Date:   Tue Jan 29 08:08:50 2019 -0800

    withdraw input validation

[33mcommit be347e959501301dd78ba9155149ecd5afb1dd34[m
Author: arjunbhuptani <arjunbhuptani@gmail.com>
Date:   Tue Jan 29 07:35:37 2019 -0800

    Input validation for swap and pay

[33mcommit 441b3b1613e5e2270b2a5cc214346d71a8cd4f28[m
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Tue Jan 29 10:23:36 2019 -0500

    fix withdrawal display bug

[33mcommit e655973748708bf8482e5526fb5b3c24a020336c[m
Author: arjunbhuptani <arjunbhuptani@gmail.com>
Date:   Tue Jan 29 05:36:57 2019 -0800

    input validation for deposit

[33mcommit 636fa13fe67533a693de14296540dd7dae95ee6f[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Tue Jan 29 02:24:25 2019 -0800

    fix depositing min

[33mcommit a473cc48bfeea921730286726239ce088f5c740a[m
Merge: 9a34455 396add4
Author: Rahul <rksethuram9@gmail.com>
Date:   Mon Jan 28 19:21:00 2019 -0800

    Merge branch 'hh-ux' of github.com:ConnextProject/indra into hh-ux

[33mcommit 9a344555fd39b2fe68c88acfa8fe5e2b7928c4ef[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Mon Jan 28 19:20:58 2019 -0800

    Show real withdrawal amount in appropriate card.

[33mcommit 396add4008e0b3af685a8a50eaf33b503a1161e7[m
Merge: b3d4789 2b6cdfb
Author: LayneHaber <layne.haber@gmail.com>
Date:   Mon Jan 28 18:58:46 2019 -0800

    Merge branch 'hh-ux' of github.com:ConnextProject/indra into hh-ux

[33mcommit b3d47899a221f98f700c7f0d7983197e7b8b9c23[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Mon Jan 28 18:58:43 2019 -0800

    fix min

[33mcommit 2b6cdfb7535a3d56d36706038486a4b98be3d648[m
Merge: a11041a 3cbd155
Author: Rahul <rksethuram9@gmail.com>
Date:   Mon Jan 28 18:31:50 2019 -0800

    Merge branch 'hh-ux' of github.com:ConnextProject/indra into hh-ux

[33mcommit a11041afb4dd90ddb59c3dee7c20c1db052a52bc[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Mon Jan 28 18:31:46 2019 -0800

    Wrong variable was being referenced

[33mcommit 3cbd1556bce2ea2eec25ef6a98ba2adf863a4c27[m
Merge: da84287 34acdd3
Author: LayneHaber <layne.haber@gmail.com>
Date:   Mon Jan 28 18:29:27 2019 -0800

    merge

[33mcommit da8428797c3225d922f06705ee233b3e5ae33630[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Mon Jan 28 18:29:01 2019 -0800

    fix eth deposit if not using metamask, add 40fin on token

[33mcommit c58b3e24c14985f654551ce5b6c74d3e896ec3f4[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Mon Jan 28 18:28:31 2019 -0800

    no approval needed

[33mcommit 34acdd341821157b3894e9e8251e84cfe91d7813[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Mon Jan 28 18:23:04 2019 -0800

    Add BigNumber util function

[33mcommit 49b964deda9f836d0b054e47324fd7760248f546[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Mon Jan 28 18:22:52 2019 -0800

    Do comparisons as BigNumbers

[33mcommit e8306c88962fe4b4be74cc96ff96bd3d666d0b0b[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Mon Jan 28 18:22:34 2019 -0800

    Push in channel state as props, not the balance arg that doesn't work.

[33mcommit b0a8c653734445da3b6ac82b5a7df0fd60a3f68c[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Mon Jan 28 18:00:13 2019 -0800

    Prettier

[33mcommit 2ad6709b04a9e6f4af3ceb777874d0095e4ca0bd[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Mon Jan 28 16:57:53 2019 -0800

    metamask err

[33mcommit 90abede5f2349628213f342f8328bdf38d605126[m
Merge: cac631d 5749f47
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Mon Jan 28 18:02:13 2019 -0500

    Merge branch 'hh-ux' of https://github.com/ConnextProject/indra into hh-ux

[33mcommit cac631d25996f5b13944417b24a1a797983b0458[m
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Mon Jan 28 18:01:13 2019 -0500

    withdraw and deposit bugfixes

[33mcommit 5749f4770df68b46982fbda6f81a7b04a645ca05[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Mon Jan 28 11:54:15 2019 -0800

    zero out values on toggle

[33mcommit 6438bfabadc5394d0a0f6d0fa25b138d9c84a471[m
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Mon Jan 28 11:59:17 2019 -0500

    autosigner polling bugfix

[33mcommit 9325a7377d8af8d9ee33c6b1ad8384d745863ee2[m
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Mon Jan 28 11:10:07 2019 -0500

    metamask issues

[33mcommit 92274d6ad581a456123902374120fef88d1352b4[m
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Mon Jan 28 10:10:06 2019 -0500

    fix modal display on page refresh

[33mcommit ab32e29103b3fe79801c408fbc01f3d66cc6541d[m
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Mon Jan 28 10:05:32 2019 -0500

    channel address tooltip

[33mcommit 5e259826a1e4b7a2bddb51fee18a95ff1a103aff[m
Merge: b8410f4 c3d450b
Author: hthillman <35902552+hthillman@users.noreply.github.com>
Date:   Mon Jan 28 09:33:03 2019 -0500

    Merge pull request #70 from ConnextProject/hh-ux-bugfix
    
    withdraw bugfix

[33mcommit c3d450b0a135e5c048322d6b21e86284f60b7cf2[m
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Mon Jan 28 09:30:30 2019 -0500

    withdraw bugfix

[33mcommit b8410f42b19d04073e50907833f1d93476a2a83a[m
Merge: 71d01ee 3387a97
Author: LayneHaber <layne.haber@gmail.com>
Date:   Sat Jan 26 09:35:10 2019 -0800

    Merge pull request #69 from ConnextProject/68-metamask-demo
    
    68 metamask demo

[33mcommit 3387a970c989169df4b5f8a5febc9f6f6d6f73d5[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Sat Jan 26 09:29:06 2019 -0800

    deposit into channel in deposit handler

[33mcommit 5746ecac6999983b74855288e1b68f272ac51c2f[m
Author: Arjun Bhuptani <arjunbhuptani@gmail.com>
Date:   Sat Jan 26 05:21:07 2019 -0800

    Update LINUX_POSTGRES.md

[33mcommit 3c11d3c69d7cdbe40f7ec1aa7be66503d2af4b81[m
Author: Arjun Bhuptani <arjunbhuptani@gmail.com>
Date:   Sat Jan 26 05:20:27 2019 -0800

    Update README.md

[33mcommit 1bc0c71c56dbd08b93791709ad243250d04400da[m
Author: Arjun Bhuptani <arjunbhuptani@gmail.com>
Date:   Sat Jan 26 05:19:54 2019 -0800

    Update README.md

[33mcommit 50174d37b69e42b2d2f7954719946c3a058da931[m
Author: Arjun Bhuptani <arjunbhuptani@gmail.com>
Date:   Sat Jan 26 05:19:35 2019 -0800

    Update README.md

[33mcommit b1b05b4e9c23aa84806acf7d9c913121d875bdbb[m
Author: Arjun Bhuptani <arjunbhuptani@gmail.com>
Date:   Sat Jan 26 05:18:53 2019 -0800

    Create LINUX_POSTGRES.md

[33mcommit 205584370f249a8739e4820aa96411e4f016732b[m
Author: Arjun Bhuptani <arjunbhuptani@gmail.com>
Date:   Sat Jan 26 03:46:16 2019 -0800

    Update README.md

[33mcommit 77817d0997038735d918edef86b8c7d7a2374a22[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Fri Jan 25 22:21:21 2019 -0800

    different paths for auto and metamask in deposit btn

[33mcommit 71d01ee15b46db91866c805f4eab1b1dad95116d[m
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Fri Jan 25 16:01:21 2019 -0500

    prettier

[33mcommit e6e2cb63604f07af11c1c14d5735b7f78df35222[m
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Fri Jan 25 15:30:29 2019 -0500

    ux overhaul

[33mcommit 6dc547fa16c641917b64a84531167d87b1de2bf9[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Fri Jan 25 10:36:51 2019 -0800

    install

[33mcommit b658f0c2ffca650b914d4266472aef4c83617613[m
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Fri Jan 25 13:33:12 2019 -0500

    UX fixes

[33mcommit 077b8254c9b1ea26d40e6d5d184da61c8fda2636[m
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Fri Jan 25 11:39:36 2019 -0500

    move tooltips

[33mcommit 3833631887f3d3e40a550dec348713a3f8167ce4[m
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Fri Jan 25 10:26:32 2019 -0500

    show mnemonic fixes + click to copy

[33mcommit 239a6daf4549bd7ca9a8abbb3cd8a1988d883102[m
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Fri Jan 25 09:45:38 2019 -0500

    create new autosigner bugfix

[33mcommit c39021aaaa6a80b4f1154b58bc06ffe30a4cf13f[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Thu Jan 24 17:31:17 2019 -0800

    Add channel address

[33mcommit 47ca7a8ba8389cd1ec14ed0e00afb6aae80cf2ab[m
Merge: fa2f787 1aee1ae
Author: Rahul Sethuram <rksethuram9@gmail.com>
Date:   Thu Jan 24 17:08:33 2019 -0800

    Merge pull request #59 from ConnextProject/replicate-spank-hub-infra
    
    [WIP] Replicate spank hub infra

[33mcommit 1aee1aec703c995faa16fdd2358305bd35ca74b3[m
Merge: 1da2c61 42a61b4
Author: Rahul Sethuram <rksethuram9@gmail.com>
Date:   Thu Jan 24 16:53:41 2019 -0800

    Merge pull request #65 from ConnextProject/Leave-gas-$$$-in-browser-wallet
    
    Leave gas $$$ in browser wallet

[33mcommit 42a61b4a2dbe2150c448eb243ebab52a449cb038[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Thu Jan 24 16:51:09 2019 -0800

    Clean up

[33mcommit 1ebdf762a3e87ff7678fbab6e58c6b8007405384[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Thu Jan 24 16:50:59 2019 -0800

    Clean up

[33mcommit c3bfe5334e0da4cda023a911d406254a79aa7b2f[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Thu Jan 24 16:50:54 2019 -0800

    Clean up

[33mcommit 2f7d8b394fac38523d7cf6f137a2f1d5267f337e[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Thu Jan 24 16:50:49 2019 -0800

    Clean up

[33mcommit d3e59ff2013e7f5c71a8e996d868c42d4f3d5237[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Thu Jan 24 16:50:42 2019 -0800

    Clean up

[33mcommit ee3351447a21035e91c95a9c9337150ff164000e[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Thu Jan 24 16:50:36 2019 -0800

    Prettier

[33mcommit 634a4e115ecde7d2b91287fb54a1cb68ba44eb2f[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Thu Jan 24 16:50:29 2019 -0800

    Remove warnings

[33mcommit ad42ba2a12ae61de211fbc2dc1160db01134bfe7[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Thu Jan 24 16:50:19 2019 -0800

    Clean up warnings

[33mcommit bd86ea714dc6b13c1c27947e724ec63125d2eb74[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Thu Jan 24 16:44:12 2019 -0800

    default to ETH

[33mcommit 3731941503afa728dd9b78efd9a4628a8b8c7638[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Thu Jan 24 16:41:51 2019 -0800

    Deposit does not deposit anymore, it transfers to browser wallet and lets poller handle it.

[33mcommit bdf924fe9e3b8cb9178ab91b6c18c059c95e1b92[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Thu Jan 24 16:40:11 2019 -0800

    Leave 40 fin in channel always.

[33mcommit 1da2c61edb428d56af6a5a76d989a76c79960c47[m
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Thu Jan 24 16:55:10 2019 -0500

    typo fix

[33mcommit ecb6d2b8ab417fbc3c0af9313de0de2b3fd1e65f[m
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Thu Jan 24 16:38:06 2019 -0500

    fixes to exchange

[33mcommit ebb1839d7a0daa8434428587f6838407546dea44[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Thu Jan 24 13:29:00 2019 -0800

    Hardcode some extra ETH for gas.

[33mcommit 8ba2907ca601b7f3f4ca0ba15aa3b321c7acb4b1[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Thu Jan 24 12:33:31 2019 -0800

    Whitespace cleanup

[33mcommit 3880fea29095cfa37a50165d0abb4872657d393a[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Thu Jan 24 12:25:46 2019 -0800

    Hit it with the prettier, tons of whitespace changes

[33mcommit 5882813e6086b81db0d36c1560cbc4369b89ad75[m
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Thu Jan 24 14:36:48 2019 -0500

    mempool bugfix

[33mcommit 65059577cfbda5b196ba71a8497f89ebf8108cf8[m
Merge: 97eedda a7e3ff5
Author: Rahul Sethuram <rksethuram9@gmail.com>
Date:   Thu Jan 24 10:52:00 2019 -0800

    Merge pull request #60 from ConnextProject/ux-bugfixes
    
    Ux bugfixes

[33mcommit a7e3ff50c83b67023a013d390374df8faedf44d5[m
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Thu Jan 24 13:48:50 2019 -0500

    autosigner fix

[33mcommit 97eedda29a82124a478b3db654779ea2b6da632e[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Thu Jan 24 10:15:06 2019 -0800

    User hub's version of concurrently

[33mcommit f19015b3c61c268c16be65276346a6b6d3cd8636[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Thu Jan 24 10:05:22 2019 -0800

    Readme updates

[33mcommit c3feee3815d7c611caf5760d563d654e0e51395c[m
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Thu Jan 24 12:07:09 2019 -0500

    ux bugfixes 1st commit

[33mcommit e96118e8effe678f21d2c8863225d12e2fef39ee[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Wed Jan 23 19:29:06 2019 -0800

    Add another address/PK to readme

[33mcommit 84d78f181eb0ebdce394b61e0cc4c8c3737b412c[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Wed Jan 23 19:16:15 2019 -0800

    README

[33mcommit cc91c20fa0f787032355dac50cab050ad1ff75bc[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Wed Jan 23 19:14:50 2019 -0800

    Add ops/ back, remove client, update readme

[33mcommit 7bde7075985fdd08f60314bef056e466d5072564[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Wed Jan 23 18:23:47 2019 -0800

    Add client to indra, use spank hub infra

[33mcommit fa2f7870845a841677ad99f535e9ff992fda4f21[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Wed Jan 23 11:38:58 2019 -0800

    compiles

[33mcommit 776daeec0db83955e3841037e53e943bc2a787c5[m
Merge: 5cce036 50e64dc
Author: LayneHaber <layne.haber@gmail.com>
Date:   Wed Jan 23 11:23:50 2019 -0800

    Merge branch 'master' of https://github.com/ConnextProject/indra

[33mcommit 5cce036ef7eb9327ea6233106cd7a47864373f39[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Wed Jan 23 11:23:47 2019 -0800

    add cleaning rule + test

[33mcommit 50e64dc0f3cf86b3363a6f903ee2533768589f00[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Wed Jan 23 10:38:45 2019 -0800

    Force refresh after creating new wallet

[33mcommit f69908021d75169f14a929e3981ca77dc6f6e647[m
Merge: b720343 f5fab89
Author: Rahul Sethuram <rksethuram9@gmail.com>
Date:   Tue Jan 22 17:23:43 2019 -0800

    Merge pull request #53 from ConnextProject/develop
    
    Develop

[33mcommit f5fab8949bf14790a96aad7468b377ecb8f96585[m
Merge: af98903 b720343
Author: Rahul <rksethuram9@gmail.com>
Date:   Tue Jan 22 17:23:06 2019 -0800

    Merge

[33mcommit af98903b8dd8059fb8af87eca3b3f0b856cc0b44[m
Merge: cc25824 1051e8b
Author: Rahul Sethuram <rksethuram9@gmail.com>
Date:   Tue Jan 22 17:17:41 2019 -0800

    Merge pull request #52 from ConnextProject/actually-extract-client
    
    Actually extract client

[33mcommit 1051e8b4b3ea62479d8bab5840d603e3dc0c7f1f[m
Merge: 8c270e8 cc25824
Author: Rahul <rksethuram9@gmail.com>
Date:   Tue Jan 22 16:44:54 2019 -0800

    Merge

[33mcommit 8c270e8fa10eca41a36ce3a3f4ee00c71c778dce[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Tue Jan 22 16:38:26 2019 -0800

    Ignore client

[33mcommit f964551c654091288371ea6d738df1804148171d[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Tue Jan 22 14:00:50 2019 -0800

    Makefile syntax bad

[33mcommit e9cef067a77455294670d467e561fe59dd70fb8a[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Tue Jan 22 13:32:01 2019 -0800

    Remove client from git

[33mcommit 04b59f6eaac3f4f77b3094a1fb7e5b6f0a53c82d[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Tue Jan 22 13:30:34 2019 -0800

    Not sure why package locks keep changing

[33mcommit 2e0d36ad1b2756669602fb7f93e065a4d36d30c2[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Tue Jan 22 13:30:02 2019 -0800

    Add script to pull in client from git.

[33mcommit cc2582429c97075399861d789c67e14e30b9d33f[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Tue Jan 22 13:29:18 2019 -0800

    install

[33mcommit 1ea3ea0f6b1b814813d5df445784fa2ab1590fac[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Tue Jan 22 13:29:08 2019 -0800

    increase dev reserve defaults

[33mcommit 2b7c7bd116b3244771df1afc4a8a2eeb94c04b46[m
Merge: 481c2d4 f3ab968
Author: Rahul Sethuram <rksethuram9@gmail.com>
Date:   Mon Jan 21 19:56:48 2019 -0800

    Merge pull request #43 from ConnextProject/extract-client
    
    Extract client

[33mcommit f3ab9687c90ab1f226af7ed50fe0ca364d885ac7[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Mon Jan 21 18:56:51 2019 -0800

    Package lock changes

[33mcommit bea4c72afd48a8c0991841659c4610370a8fa259[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Mon Jan 21 18:12:03 2019 -0800

    Update client code

[33mcommit 61922c16a902b03fb399f0cf45e39d58105ea7fd[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Mon Jan 21 18:10:41 2019 -0800

    Use proper branch

[33mcommit 872e95cdbc8fa38737edb55b49c82e1f67415efe[m
Merge: c6bfe0d c64691d
Author: LayneHaber <layne.haber@gmail.com>
Date:   Mon Jan 21 15:08:15 2019 -0800

    Merge branch 'extract-client' of https://github.com/ConnextProject/indra into extract-client

[33mcommit c6bfe0ddf51498e27303599a386de4e46b137001[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Mon Jan 21 15:08:12 2019 -0800

    install

[33mcommit c64691d3f0851a96c3102f7c0991b5a07583049b[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Mon Jan 21 11:36:46 2019 -0800

    Add migration step to entry point.

[33mcommit e345c7d368864a913614d72420b3fd901d7a54b4[m
Merge: 8453515 1a23fb3
Author: Rahul Sethuram <rksethuram9@gmail.com>
Date:   Mon Jan 21 10:55:10 2019 -0800

    Merge pull request #50 from ConnextProject/material-ui
    
    Material ui

[33mcommit 84535157bb38d11fce06f7b38fa3e2d6eafe4655[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Mon Jan 21 10:29:26 2019 -0800

    remove yarn

[33mcommit e29a2179eb2cc07b683041220d0ea0119432f8ee[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Mon Jan 21 10:29:13 2019 -0800

    latest changes from sc develop

[33mcommit 1a23fb3794f30b6a2965513320459e68deaf18cc[m
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Mon Jan 21 12:52:54 2019 -0500

    css and wallet recovery

[33mcommit f6269a505d78febed11040cfd26ed80fc540fed8[m
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Mon Jan 21 09:18:56 2019 -0500

    fix key display

[33mcommit b5bf885f32e009a66ec90b499818b02bc44ceaba[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Fri Jan 18 22:35:29 2019 -0800

    rename imports

[33mcommit c5c4fc750542e875e09efecf0e9c1ea56ecd1d44[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Fri Jan 18 22:32:15 2019 -0800

    rename connext to client

[33mcommit 430a1ab469e1dbbfa60fc20aa11c46f2322c42b5[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Fri Jan 18 20:16:58 2019 -0800

    add in current sc develop

[33mcommit e03bbe95c14a81aae9e42e50a82c161bbe284cdd[m
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Fri Jan 18 17:21:14 2019 -0500

    fix recovery bug

[33mcommit f2466372377de1f80e249ba3003f27de1bf9aaf8[m
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Fri Jan 18 17:07:34 2019 -0500

    fix requestcollateral

[33mcommit 30b09d00353a60b5010b82094fae6afee8b40407[m
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Fri Jan 18 16:17:10 2019 -0500

    fix channel balance display

[33mcommit f37b9f275167506000566cf82b25b5b6ffffaa8a[m
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Fri Jan 18 13:10:58 2019 -0500

    add wallet recovery flow to modal

[33mcommit 3c11a59b8100d8958c3e1ef07f6501eb68eb6f7f[m
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Thu Jan 17 16:28:27 2019 -0500

    fix signer-select modal

[33mcommit 59b8cac6a6ab52ca1b5b42e04031de45b343d529[m
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Thu Jan 17 15:28:58 2019 -0500

    e2e

[33mcommit 37d4663e1f0bf250f567db8e880e4c8e2e6dfa68[m
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Wed Jan 16 15:58:24 2019 -0500

    split components out

[33mcommit fb7d2c891eb573d28dbae25e7ef8e69f93c15366[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Thu Jan 17 10:37:06 2019 -0800

    running with these package-locks

[33mcommit b7203437b9b27b2071df5b288d64843654a42d0c[m
Merge: 0390326 481c2d4
Author: Rahul Sethuram <rksethuram9@gmail.com>
Date:   Wed Jan 16 12:58:02 2019 -0800

    Merge pull request #44 from ConnextProject/develop
    
    Ready for release

[33mcommit 5b7cba7ddf303b15e6a9617c6d6911368bf92e27[m
Merge: a85ea80 481c2d4
Author: Rahul <rksethuram9@gmail.com>
Date:   Tue Jan 15 14:25:12 2019 -0800

    Merge

[33mcommit a85ea800db0571690ff60723aed904d026340e99[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Tue Jan 15 14:23:30 2019 -0800

    Package locks

[33mcommit 13845d598ef61a52465af4efe058324fbe325872[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Mon Jan 14 18:40:31 2019 -0800

    Add nodemon

[33mcommit 4f713f9be1a450c0f0789c01d0d5a9cd6f07ed5c[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Mon Jan 14 18:40:22 2019 -0800

    Revert change

[33mcommit 87264710bad87a08fe19eb5d6f1d46fb786da723[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Mon Jan 14 18:29:07 2019 -0800

    Update code from camsite

[33mcommit 481c2d4418c1b7847429ac7087d3173dbc600fc8[m
Merge: 4651a1e cbd2994
Author: LayneHaber <layne.haber@gmail.com>
Date:   Mon Jan 14 11:46:18 2019 -0800

    Merge pull request #35 from ConnextProject/26-metamask-user
    
    26 metamask user

[33mcommit cbd29941927fce8bc1eb2049200ee4e874c8209d[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Mon Jan 14 11:45:53 2019 -0800

    fix for demo

[33mcommit 06a176fc199203e83033fac5c2c36160edcdcd79[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Mon Jan 14 16:17:32 2019 +0530

    rm stale linkage code

[33mcommit ac0e0f13a5c510aac78b2d40c8d8e6a7a0528646[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Mon Jan 14 08:30:06 2019 +0530

    fix client link in hub & wallet

[33mcommit 021adfdcbc914582ff7c3452757873f3ae3855df[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Mon Jan 14 08:07:28 2019 +0530

    Update readme

[33mcommit 2b0063c6e6db2401fe4ef736e648c618cd9b1f82[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Mon Jan 14 00:24:04 2019 +0530

    Pack local client into prod-mode hub

[33mcommit 78f71d4b84523d785bf4a33566c45b5cd32988e5[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Jan 13 22:19:35 2019 +0530

    make: fix installations

[33mcommit 7ab008742b2d4eeba755a0db1916aa082b20ecf2[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Jan 13 22:07:54 2019 +0530

    refactor permissions-fixer

[33mcommit 4566dcef390dcdfcabaacd6ead1df1f729f1bb05[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Jan 13 21:40:56 2019 +0530

    make: fix client dependency

[33mcommit 8dee8aa769ce091430060f0f62e8ce6c4488838e[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Jan 13 21:31:02 2019 +0530

    setup npm ln in Makefile rather than entrypoints

[33mcommit fa86339b220497d9c33e8f457a2dbd6a49721aab[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Jan 13 21:30:40 2019 +0530

    misc cleanup & bigfixes

[33mcommit 4f0b0557a5f1172be7caa059c44ea70fe0ca72cf[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Jan 13 21:29:20 2019 +0530

    refresh npm lockfiles

[33mcommit 2902e8f0b0c4d12e40be5f59c8f71e9756d68921[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Jan 13 19:23:49 2019 +0530

    fix bug in hub startup & link to client

[33mcommit d52dac2e796943b17f688091cf49277747714435[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Jan 13 19:23:19 2019 +0530

    little ops tweaks

[33mcommit 2ea32c43d324b8c02346032e0126e8c4083b802a[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Jan 13 18:47:19 2019 +0530

    purge yarn, migrate entirely to npm

[33mcommit 4c0c13e2c5a71dad64d58dd7eb11bce3b96b03ae[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Jan 13 18:23:53 2019 +0530

    hub: remove stale dependencies

[33mcommit 9d01c4e104cd45167533eb1b0a98c76036c84984[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Jan 13 17:33:48 2019 +0530

    hub: fix prod-mode startup bug

[33mcommit 23b2be881cbe44b5f297a89f465f5a7a4d3c5623[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Jan 13 17:17:33 2019 +0530

    builder: upgrade to yarn v1.13

[33mcommit 133fdb52e15113c85cbb6e914f067331b27b2fe8[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Jan 13 16:04:55 2019 +0530

    hub: revert entrypoint to spankchank

[33mcommit 088618c358348c9cbd66adb40edd8724c6ac6a2a[m
Merge: 760b916 4651a1e
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Jan 13 15:29:02 2019 +0530

    Merge branch 'develop' into extract-client

[33mcommit 6ae2c5466f9b0f40402884220ccbe331f603a532[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Sat Jan 12 22:54:56 2019 -0800

    fixes

[33mcommit 8a25679b57e1737701d0cd0081508ef6c94954b0[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Sat Jan 12 22:37:44 2019 -0800

    clean

[33mcommit a440b7d8f74ac9ad5b50b64363f5092ff110f9d4[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Sat Jan 12 22:36:44 2019 -0800

    destructuring

[33mcommit da6bf5ce0169e9a9412b5c2cb47c511596efef27[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Fri Jan 11 23:49:35 2019 -0800

    fix wallet for metamask

[33mcommit 4b2539162b467f2495fb4d96013165e9552b11f8[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Fri Jan 11 23:48:29 2019 -0800

    add helper

[33mcommit 2f4dd011960ade8689417bde85de5091e027c59c[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Fri Jan 11 23:48:10 2019 -0800

    revert to personal sign, is personal in prod

[33mcommit c8be8ecc1d89b97bc1475b324a65a563e1c9522b[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Fri Jan 11 21:48:19 2019 -0800

    fix set wallet and set connext

[33mcommit 215c737d449686d45bdb240ae3e14346adc2e5c7[m
Merge: d876a44 71d0253
Author: LayneHaber <layne.haber@gmail.com>
Date:   Fri Jan 11 19:58:57 2019 -0800

    merge in ux changes

[33mcommit 71d02531a4e844ec49daaa0857cc813dac0b15c5[m
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Fri Jan 11 15:14:14 2019 -0500

    ux improvements

[33mcommit 4651a1e6af399560d1ae27686d881c8faab279a6[m
Merge: 2e3e1ea 502a363
Author: Rahul Sethuram <rksethuram9@gmail.com>
Date:   Fri Jan 11 09:36:26 2019 -0800

    Merge pull request #34 from ConnextProject/UI-flow
    
    Ui flow

[33mcommit 03903267a2b097d917f9660949434b6614d520d8[m
Author: hthillman <35902552+hthillman@users.noreply.github.com>
Date:   Fri Jan 11 11:05:02 2019 -0500

    Update README.md

[33mcommit cddb9fcfd256bdd90e9506dfe99b10e3456b08b1[m
Author: hthillman <35902552+hthillman@users.noreply.github.com>
Date:   Fri Jan 11 11:04:33 2019 -0500

    Update README.md

[33mcommit 502a363386ab426c8ef22b8f1047e9476de9a7ab[m
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Thu Jan 10 16:47:32 2019 -0500

    add dropdown and bundle deposit flow

[33mcommit bbe527a9202fd6a73a5b30b9320cdf91b67f06d2[m
Merge: 32a87fc b2d06c7
Author: Rahul <rksethuram9@gmail.com>
Date:   Thu Jan 10 11:02:38 2019 -0800

    Merge branch 'wallet-demo-ui' into UI-flow

[33mcommit 32a87fca3aafb5705a68441b4627f86cf4ad9fe9[m
Author: Hunter Hillman <hthillman@Hunters-MacBook-Pro.local>
Date:   Thu Jan 10 13:11:29 2019 -0500

    bundle UX components

[33mcommit b2d06c7d6ed91112f427d4ebfe842a0627fe0381[m
Author: arjunbhuptani <arjunbhuptani@gmail.com>
Date:   Thu Jan 10 08:25:26 2019 -0800

    minor padding

[33mcommit 760b91616bc1c59b87a3308b96f904cc16045847[m
Merge: cbef365 2e3e1ea
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Jan 10 19:52:25 2019 +0530

    Merge branch 'develop' into extract-client

[33mcommit 26a7e268eb75c176088cc20da6bd6b7be7b68163[m
Author: arjunbhuptani <arjunbhuptani@gmail.com>
Date:   Thu Jan 10 05:05:27 2019 -0800

    finished grid layout

[33mcommit cbef365f63a778e490e5cb0e4dbb9fab1cdc8629[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Jan 10 17:33:59 2019 +0530

    fix watcher flags

[33mcommit 38e9194db6b4bf5069a6baba523e361bbaeb7a23[m
Author: arjunbhuptani <arjunbhuptani@gmail.com>
Date:   Thu Jan 10 03:27:27 2019 -0800

    basic grid alignment WIP

[33mcommit 432a32c194ffde50ef424c54b922e71e40525d44[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Jan 10 13:50:44 2019 +0530

    hub: re-enable features that require connext-client updates

[33mcommit 3e5def304729e892038379ddea4c28d3c2f26a04[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Jan 10 13:12:32 2019 +0530

    wallet: tweak default payment

[33mcommit 3ced9867ade45edd3b9e1bc1a1e56e4195996d1e[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Jan 10 12:49:44 2019 +0530

    contracts: make truffle dockerfile a little less dependent on indra

[33mcommit e68e45e6043ea8b1b4251d5295aa6ac1fb2097c9[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Jan 10 12:48:54 2019 +0530

    make: npm->yarn

[33mcommit b91eee7125d13056c1cdc836b70780ed9d431fa2[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Jan 10 12:47:08 2019 +0530

    client: setup containerized tests

[33mcommit 3249e47df7d1aad336b7585546e5842f043f6aff[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Jan 10 12:19:07 2019 +0530

    client: merge changes in from connext-client#master

[33mcommit 9b242ef5fe0451add856a8d1ecbb22c7f59c443e[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Jan 10 11:48:37 2019 +0530

    ops: update yarn logs to print ganche output

[33mcommit a9062ddad2d57eb98b4f36f6bb46e4f8ca1bbd86[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Jan 10 11:33:56 2019 +0530

    init ops/get-db-url.sh

[33mcommit 2e3e1eaeb80e559d3ed7352fa595b83d4c17817b[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Wed Jan 9 21:58:00 2019 -0800

    Authorize on load

[33mcommit d876a44b96091e361615da2b89d6430fa79c5cf5[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Wed Jan 9 21:50:30 2019 -0800

    signing with metamask, client not flowing properly

[33mcommit 01fce486dc03706964a6ebb1780bfe7e9cab5d5e[m
Merge: 6cdfa76 d39cd55
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Jan 10 09:45:05 2019 +0530

    Merge branch 'develop' into extract-client

[33mcommit b3beb6233c154f48e97a6faabeaa9e9ec5e149ac[m
Merge: f04c47a 7f56634
Author: Rahul <rksethuram9@gmail.com>
Date:   Wed Jan 9 20:30:03 2019 -0800

    Merge branch 'master' into develop

[33mcommit f04c47aa6bde35535be132259692a4491dff7865[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Wed Jan 9 20:27:46 2019 -0800

    Remove db migrations

[33mcommit 6cdfa7693a4073a1404b21e57eb9188e1b7a6a62[m
Merge: e8a3f56 7f56634
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Jan 10 09:32:20 2019 +0530

    Merge branch 'master' into extract-client

[33mcommit 7f56634d2b984ada9efa17ca25545046279a76e1[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Jan 10 09:22:28 2019 +0530

    package.json: update reset script

[33mcommit 095c207745676019a8d69c4620905656fdd20472[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Jan 10 08:40:44 2019 +0530

    readme: add more trouble shooting info

[33mcommit 9f1802b95fcd7a01aef60e3c57ca0dfb459d11c1[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Jan 10 08:39:39 2019 +0530

    add reset command to Makefile & make purge less aggressive

[33mcommit e8a3f5601eed74a603d957d41fc51f66ed963b8c[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Jan 10 00:16:14 2019 +0530

    restore changes made to local copy of client

[33mcommit d39cd55f2c6c062b03d036cfa9b0b8ba4ae4b581[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Wed Jan 9 16:12:27 2019 -0800

    remove approval

[33mcommit 0dc40549dcb82148b2e76648cfe257464fc339b3[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Wed Jan 9 16:04:42 2019 -0800

    button auto withdraw to metamask

[33mcommit b1c3c5a8c0f98b2a88d95ed597f289f6e8e3bcf7[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Wed Jan 9 15:59:00 2019 -0800

    set tokenAddress in connext

[33mcommit 048443290367cb3f093613c6f9e0a2045b2f8127[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Wed Jan 9 15:50:02 2019 -0800

    fix getToken

[33mcommit 7fd5cba99321425042392cf2a0b9bac882a07339[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Wed Jan 9 14:09:19 2019 -0800

    fix signing from wallet

[33mcommit efe6c435fa5e09e35327bf0c085011353418ac82[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Jan 10 00:07:03 2019 +0530

    wallet: fix token approval button

[33mcommit 06084f2f2f2c7d12c7d7b099282b41290db5453c[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Wed Jan 9 23:47:15 2019 +0530

    readme: add more trouble shooting info

[33mcommit 531f5369ffed5770aea9c4e5684babb10c38643a[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Wed Jan 9 21:08:10 2019 +0530

    update local client module to be the one deployed to npm

[33mcommit ebe94597f46c682d85bddaa0f3e9e61e0486ffcb[m
Author: hthillman <35902552+hthillman@users.noreply.github.com>
Date:   Wed Jan 9 09:24:27 2019 -0500

    Update README.md

[33mcommit 44588ae87da70c1db87a3f034f08141869fa0b5f[m
Merge: 135eb8e 00a32e5
Author: Bo Henderson <bohende@gmail.com>
Date:   Wed Jan 9 15:50:55 2019 +0530

    Merge branch 'develop' into extract-client

[33mcommit 135eb8e065453b9dd1d5e5957b40cd2bd10a71ba[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Wed Jan 9 13:01:40 2019 +0530

    hub: revert a couple changes incompatible w current version of connext

[33mcommit 6077e93fbb08d63febc18aab119f05074b3cbab8[m
Merge: fe1a233 57de772
Author: Bo Henderson <bohende@gmail.com>
Date:   Wed Jan 9 11:32:41 2019 +0530

    Merge branch 'develop' into extract-client

[33mcommit 00a32e5026c96a439eb62cd601d7819788ccbc99[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Tue Jan 8 22:22:14 2019 -0800

    temp signing fix

[33mcommit 86361528557de3f2c2106197bc4ae95421c9ef69[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Tue Jan 8 22:22:02 2019 -0800

    create wallet fix

[33mcommit 5aa91bfc3105cbf24eb64b766e5f954b1b721d87[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Tue Jan 8 20:30:09 2019 -0800

    fix metamask button

[33mcommit 65ceef05b8548e9223c1ccdc695d5519fa2a8475[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Tue Jan 8 20:13:14 2019 -0800

    send transactions from metamask successfully

[33mcommit 57de772d66459a6ca7a51f852022eaa7bc1e20b3[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Tue Jan 8 17:56:51 2019 -0800

    Recover account

[33mcommit 027fbcc2aa64d80d1a5cf7aa1633ecf09c3f6b52[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Tue Jan 8 17:36:46 2019 -0800

    Auth works!

[33mcommit 95aa5278ba090fb8cca9e8fd8c99838c551d62cc[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Tue Jan 8 17:30:01 2019 -0800

    Removing ethers in favor of web3

[33mcommit b8fe1fedaa1c58de064526d117e13c7e93c1f8ad[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Tue Jan 8 15:58:26 2019 -0800

    Need to use web3

[33mcommit b15ccce2bbefbe4f163ef7050c13555c37d4efce[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Tue Jan 8 15:58:15 2019 -0800

    Lower case changes

[33mcommit 773a12dcd02ba2ae38de53dc6c4a2f096ae5926e[m
Merge: f524ef7 43f5602
Author: Rahul <rksethuram9@gmail.com>
Date:   Tue Jan 8 14:52:32 2019 -0800

    Merge branch 'develop' of github.com:ConnextProject/indra into develop

[33mcommit f524ef7f1e83ceda69c712791285c3d75bca853f[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Tue Jan 8 14:52:29 2019 -0800

    Update with latest code

[33mcommit 43f560228e8918aef4e8668778606ccb3cde0ed9[m
Merge: fcf9d62 3cf5b1f
Author: LayneHaber <layne.haber@gmail.com>
Date:   Tue Jan 8 14:40:59 2019 -0800

    Merge branch 'develop' of https://github.com/ConnextProject/indra into develop

[33mcommit fcf9d6217b747c3538201adbf5e66588958eb9f1[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Tue Jan 8 14:40:43 2019 -0800

    client changes

[33mcommit 517693427a72852b925c672d3707a23e4783391a[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Tue Jan 8 14:40:35 2019 -0800

    Ignore ds store

[33mcommit 3cf5b1fa07d94400e29d9caba64f3dc8288e53bb[m
Merge: 1d69902 c1d93e2
Author: Rahul <rksethuram9@gmail.com>
Date:   Tue Jan 8 14:39:40 2019 -0800

    Merge branch 'master' into develop

[33mcommit 1d69902237eee868d5e7130e94403347f164c52c[m
Merge: d856ab1 58e1b0b
Author: Rahul Sethuram <rksethuram9@gmail.com>
Date:   Tue Jan 8 14:38:53 2019 -0800

    Merge pull request #28 from ConnextProject/remove-migrations
    
    Remove migrations

[33mcommit 58e1b0b7fe8aad36737eebf485eda5ef38c6fb32[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Tue Jan 8 11:11:40 2019 -0800

    Remove migrations

[33mcommit c74cc5a51777faf2714d6f63c73cdd214f2354f3[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Tue Jan 8 11:11:31 2019 -0800

    Remove machinomy migration dependency

[33mcommit c1d93e27061bc57002764b6586a841dc1c08c5e2[m
Merge: f58f2da 0cbe814
Author: Arjun Bhuptani <arjunbhuptani@gmail.com>
Date:   Tue Jan 8 19:15:02 2019 +0400

    Merge pull request #22 from ConnextProject/add-license-1
    
    Create LICENSE.md

[33mcommit 0cbe814ea953e206782c7442df7eb2db0d4f7121[m
Author: Arjun Bhuptani <arjunbhuptani@gmail.com>
Date:   Tue Jan 8 19:14:35 2019 +0400

    Create LICENSE.md

[33mcommit f58f2da873f332e538ed28e8caa94ee6ab06ea9b[m
Author: hthillman <35902552+hthillman@users.noreply.github.com>
Date:   Tue Jan 8 09:18:27 2019 -0500

    Update README.md

[33mcommit c405b0d88d7ca4f781063ab4f7f3bf4a75501708[m
Author: hthillman <35902552+hthillman@users.noreply.github.com>
Date:   Tue Jan 8 09:01:23 2019 -0500

    Update README.md

[33mcommit 2eb520f7ef143d40573751a38fd3627b214e4ddb[m
Author: hthillman <35902552+hthillman@users.noreply.github.com>
Date:   Tue Jan 8 09:00:54 2019 -0500

    Update README.md

[33mcommit 97628a6e0a029bb9f49eb01b07954aebc4d09db3[m
Author: hthillman <35902552+hthillman@users.noreply.github.com>
Date:   Tue Jan 8 09:00:10 2019 -0500

    Update README.md

[33mcommit d5dddacc599b90a98afeaf311c363b3726f4f7ff[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Mon Jan 7 20:07:03 2019 -0800

    Updated yarn locks, update DB

[33mcommit 91665023f4379cd30bb769373f063e3a771dfcc5[m
Author: hthillman <35902552+hthillman@users.noreply.github.com>
Date:   Mon Jan 7 17:03:29 2019 -0500

    Create CONTRIBUTING.md

[33mcommit fe1a2331eccf61b870d22778f88572b455560d71[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Mon Jan 7 21:44:25 2019 +0530

    hub: rm -rf modules/hub/src/vendor

[33mcommit 520c908b05195cafffa984eb402dceac9f3fbeb3[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Mon Jan 7 21:38:15 2019 +0530

    hub: migrate to use external connext & new bignumber api

[33mcommit a672a3e7f12db94ee9324e4e6b09ca38d4859801[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Mon Jan 7 21:37:24 2019 +0530

    makefile: finish removing client-specific stuff

[33mcommit d0ebb9df0a2c3e4a5459916d8252779f4af468cd[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Mon Jan 7 21:34:51 2019 +0530

    hub: specify version for bignumber.js

[33mcommit 959f5535497d19e117ba696d748ff5bb5dec527a[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Mon Jan 7 17:41:32 2019 +0530

    makefile: remove any client-related make commands

[33mcommit fa7783a4fb4e11b535f485f7b7d6182c4beb2adf[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Mon Jan 7 17:41:10 2019 +0530

    wallet: remove yarn-linkage

[33mcommit bc5a0e4af7cb108cc51a0745679e5552a632b465[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Mon Jan 7 08:48:56 2019 +0530

    makefile: make purge less aggressive

[33mcommit 18f718e9993ae2abdb0766539d4620897bdfc953[m
Merge: fe46f8f d856ab1
Author: Rahul Sethuram <rksethuram9@gmail.com>
Date:   Sat Jan 5 12:02:36 2019 -0800

    Merge pull request #21 from ConnextProject/develop
    
    Develop

[33mcommit d856ab15832f8414f05977e300a77c1d8722094b[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Sat Jan 5 12:00:05 2019 -0800

    Delete package-lock

[33mcommit fe46f8f7c83e93e51399d2ee7434e70feedf5a44[m
Author: hthillman <35902552+hthillman@users.noreply.github.com>
Date:   Fri Jan 4 12:31:36 2019 -0500

    Create PULL_REQUEST_TEMPLATE.md

[33mcommit 91e26536eaf48b16e881d4bff8702b81c0dc9a8f[m
Author: hthillman <35902552+hthillman@users.noreply.github.com>
Date:   Fri Jan 4 12:30:52 2019 -0500

    Create ISSUE_TEMPLATE.md

[33mcommit de5630eededbe32a2cd6cb246f5ae922da72e6a1[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Fri Jan 4 09:06:48 2019 +0530

    readme: update deployment instructions

[33mcommit 9912a7653145e052c43a975f03404a909a11ff88[m
Author: Arjun Bhuptani <arjunbhuptani@gmail.com>
Date:   Thu Jan 3 18:09:54 2019 -0700

    Update ConnextArchitecture.xml

[33mcommit 2660b70cc18cc1d4f428441416c1f39b14605f89[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Thu Jan 3 15:17:17 2019 -0800

    Show mnemonic not PK

[33mcommit d431c81e32ca38697e5396fe8f93c9b5afd31c2b[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Thu Jan 3 15:17:01 2019 -0800

    Package lock and yarn lock

[33mcommit f10bfa3c6f3496fe6b2c6fd3ce41df972167a93a[m
Author: Rahul Sethuram <rksethuram9@gmail.com>
Date:   Thu Jan 3 13:42:04 2019 -0800

    Added ConnextArchitecture.xml

[33mcommit 6e57eea456f326b37636d9b6747e252218b50b53[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Wed Jan 2 14:11:15 2019 -0800

    Readme quick update

[33mcommit b1ebc5765d2dfe6b6a8fa176fd19730909b3f9ee[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Fri Dec 28 10:54:15 2018 +0530

    init wallet prod.env and fix make deploy

[33mcommit 0bd717a0e9df2f4f216ee65f262f2daa6094fac9[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Fri Dec 28 09:50:10 2018 +0530

    fix proxy-ethprovider communication

[33mcommit a0d06188e9e280a2bd500faecc8d5b67a529310b[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Fri Dec 28 09:25:05 2018 +0530

    fix some proxy bugs (beware: might be other bugs present)

[33mcommit 9cf4d77f62371be768ef0e154e2383d4e42f29b6[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Fri Dec 28 09:17:50 2018 +0530

    add warning to readme

[33mcommit 163bf551adce1710538b367c52fda2971be31b05[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Fri Dec 28 09:16:01 2018 +0530

    add ethprovider to proxy

[33mcommit e6188fb517c744d29579548134169a9291142ec4[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Fri Dec 28 09:12:25 2018 +0530

    add proxy to prod deployment

[33mcommit af9c4f61e7ef569a1ec1f2a9330c595397ed9c99[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Thu Dec 27 09:48:35 2018 -0800

    Scripts were having some issues

[33mcommit 5527e87401702ee78ed8dc39469d022c6d8e95a3[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Thu Dec 27 09:25:18 2018 -0800

    Purge should deep clean

[33mcommit ee7eae519b7695dd55b37ac5195f5648e517e6fd[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Thu Dec 27 09:22:53 2018 -0800

    Need to use window.location

[33mcommit 8f04e02cb907119864150ad50c4ff145d8646d16[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Dec 27 11:05:44 2018 +0530

    readme: upgrade deployment instructions

[33mcommit 7313645062de99fcd6d4d9d12edfebcc24630d73[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Dec 27 11:00:24 2018 +0530

    makefile: tiny bugfix

[33mcommit 1dd33fda43c0c0cf183c65204589783491921e95[m
Merge: 245850d 28bbcba
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Dec 27 10:55:16 2018 +0530

    Merge branch 'integrate-wallet'

[33mcommit 28bbcba74d47f1f3bc8426288170ae7da9158c42[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Dec 27 10:54:49 2018 +0530

    mention deep-clean script in readme

[33mcommit c8cee570dbeab1eaccc87fa4126149d1d07d5950[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Dec 27 10:46:47 2018 +0530

    upgrade readme & tweak deploy scripts

[33mcommit d66bbb6bd10031744e95b6842c731ef145fae3a1[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Wed Dec 26 21:05:13 2018 -0800

    add fresh yarn.locks

[33mcommit 346a36e3f39ae4062bded672d955f3b3fef1ed4b[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Wed Dec 26 21:04:26 2018 -0800

    add .npm dir

[33mcommit 2d9a3062ac32acc0a4f5af889ec3b307aac6b6b5[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Wed Dec 26 21:03:27 2018 -0800

    add git ignore stuffs

[33mcommit bda706272fd7400639f32a30b00a28c5b702ba74[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Wed Dec 26 21:03:12 2018 -0800

    deep clean scripts

[33mcommit d377ff1532b5ebf55f4cd2aa1ddcffa7d0b43967[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Wed Dec 26 21:03:02 2018 -0800

    add deep-clean

[33mcommit 12af80e2c26ceedd1229243c56c6d0739712d664[m
Author: LayneHaber <layne.haber@gmail.com>
Date:   Wed Dec 26 21:02:48 2018 -0800

    update connext client version

[33mcommit 5ca7692a7da84075a6e765d8267a2a2670b51d2f[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Wed Dec 26 15:28:59 2018 -0800

    Get exchange rate and make withdraw max work

[33mcommit 0b4b84145016dda17fdac2b38cc4ac0d21dd2746[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Wed Dec 26 15:02:42 2018 -0800

    Add function to create new wallet

[33mcommit 2eebbe68e9c36f8d0ccc1a8633efd7985a79e5be[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Wed Dec 26 15:02:22 2018 -0800

    Style fixes from prettier (sorry)

[33mcommit 28b6e622fc82bd6890c154d960a7dbee68db38c7[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Wed Dec 26 13:02:48 2018 -0800

    Set default vals, fix payment infrastructure, add exchange functionality.

[33mcommit 6862c85912ce4e521055c9c85cca6f2e303c1468[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Wed Dec 26 13:01:47 2018 -0800

    Don't regenerate wallet every time

[33mcommit 328129e6ef1ce396d4f122477c095d5c2675dcf6[m
Author: shivani <gupta.shivani254@gmail.com>
Date:   Mon Dec 24 16:07:41 2018 +0530

    wallet: cosmetic add channel info

[33mcommit 93bd7fd0beb354bc110bbf67e2186969a3b4a595[m
Author: shivani <gupta.shivani254@gmail.com>
Date:   Mon Dec 24 16:07:09 2018 +0530

    client: short circuit approval

[33mcommit 4c50eca775bce5a72420b3208e8e6de6d75c699d[m
Author: shivani <gupta.shivani254@gmail.com>
Date:   Mon Dec 24 16:06:26 2018 +0530

    client: lower case

[33mcommit 3c0ba0f043985724db79387e7ce34d49600876e2[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Mon Dec 24 16:01:06 2018 +0530

    wallet: better logs

[33mcommit 05eebe930a4ff73e6b7fbd73ab30e72c3e620915[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Mon Dec 24 15:55:31 2018 +0530

    wallet: reorganize UI & fix payment bug

[33mcommit 2f07dd342b6b89b619bd38d22d3b32d41eda1efc[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Mon Dec 24 15:43:37 2018 +0530

    wallet: add eth/tst stuff to ui

[33mcommit 6fb47cf6fc56ecac3ec5b9f25a2ccf750fac192f[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Mon Dec 24 14:01:43 2018 +0530

    client: lower case

[33mcommit 58c8de9161863f4284da67cffe501dab81025fe1[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Mon Dec 24 13:44:26 2018 +0530

    client: arrayify hashes before signing

[33mcommit 7d6dcd97177ef665488178bb275a00ed818c2ac3[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Mon Dec 24 13:43:44 2018 +0530

    hub: fix signer service

[33mcommit 569809735f0a8ddaca12a4bb2ef7092cd1064a41[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Mon Dec 24 12:30:35 2018 +0530

    hub: fix signer service

[33mcommit e345e328643a2e455daf80f5a0103c471fc99acc[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Mon Dec 24 11:27:40 2018 +0530

    wallet: fix check for metamask

[33mcommit e35b26f0d38051395c1f86ddd75ceccf14931987[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Mon Dec 24 11:20:24 2018 +0530

    client: code walkthrough & debug w shiv

[33mcommit 51a95d6b14bc223cbfa7f252c89bd4250a0c9198[m
Author: shivani <gupta.shivani254@gmail.com>
Date:   Mon Dec 24 12:29:00 2018 +0530

    client: fix recover signer

[33mcommit 3634b1c142867dadacbc58bd3fa0f5471929c4ef[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Sun Dec 23 20:14:08 2018 -0800

    Lower case

[33mcommit 2bb6f2c00cc12fbcf6533715bbfee4bba192e67b[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 23 21:28:25 2018 +0530

    wallet: cosmetic tweaks

[33mcommit 5204739d47253fe9b6d59b4c5a11047ff52e8b22[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 23 21:27:43 2018 +0530

    hub: sync w camsite commit db4fe9a3

[33mcommit 3a54da835aefee788d8d58704e0c3f5f54d325e9[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 23 21:27:36 2018 +0530

    client: sync w camsite commit db4fe9a3

[33mcommit 8fe660368f1b77aa9ae3107fcb03bfd6c186cd27[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 23 21:19:41 2018 +0530

    database: sync w camsite commit db4fe9a3

[33mcommit b33797df53f3372ae32f8318167217f43fa19bba[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 23 20:36:29 2018 +0530

    wallet: add account status for channel manager

[33mcommit fcbabbb5388a5c4bda51f48ea306e3066a477538[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 23 19:48:01 2018 +0530

    wallet: add info from metamask

[33mcommit 82b7869e55f9dd4c5f4445e01dbaa5278d659f09[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 23 19:15:06 2018 +0530

    add buttons to get eth/tokens from metamask

[33mcommit 165b31713f56e14acc7f5301813c3a85db141daf[m
Author: shivani <gupta.shivani254@gmail.com>
Date:   Sun Dec 23 18:49:35 2018 +0530

    add token balance

[33mcommit a02e2f82b6774d661ee5c990491ef26ebffbf6df[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 23 18:45:06 2018 +0530

    wallet: fix token contract initialization

[33mcommit fc984bc081d2b44fde3335b882da9a027e2ebabb[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 23 18:17:42 2018 +0530

    wallet: remove one more watcher

[33mcommit 821099c3026fb1732a8ad22813c3944c3db9f4c1[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 23 18:11:28 2018 +0530

    wallet: reorganize abis

[33mcommit 872d4e86bfb83ff10d02a06cb5fa38a88b7ca982[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 23 16:59:33 2018 +0530

    ops: add watcher flag to wallet too

[33mcommit 4cebc711657831bbaa961b28acb7b4ce93f39cd3[m
Author: shivani <gupta.shivani254@gmail.com>
Date:   Sun Dec 23 16:48:34 2018 +0530

    init metamask web3 connection

[33mcommit fcb40ee93a5666c3c78f0f53044c90c60dcd8cc8[m
Author: shivani <gupta.shivani254@gmail.com>
Date:   Sun Dec 23 15:31:28 2018 +0530

    Fix environment variable and gas estimate

[33mcommit 02095e521126170481736109e5724f0d4bb2f2b4[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 23 16:46:15 2018 +0530

    ops: random fixes & optimizations

[33mcommit a6dd952e48eda3e43605fd506480abbd9b12024a[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 23 16:43:18 2018 +0530

    ops: add script to unlock the database

[33mcommit 30825b9e789832c83217e28b567d1478f9c2f3cb[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 23 16:32:15 2018 +0530

    ops: add flags to toggle watchers on/off

[33mcommit c38f3653c593467aa6da03a9bb6e492b44344e7c[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 23 15:20:15 2018 +0530

    misc bug fixes

[33mcommit ec89eb443ff246f2e32e0088a146b0723531efd8[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 23 14:35:54 2018 +0530

    hub: fix capitalization comparison bugs

[33mcommit 133a2d34f1afb2b2336b9d38277857eeb1af74c3[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 23 13:53:56 2018 +0530

    contracts: add another migration for dev env setup

[33mcommit 8b457db77dfa0a4ad8c505a288fcb61c35edd7b7[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 23 13:51:53 2018 +0530

    wallet: set env vars based on contract artifacts

[33mcommit 411ccae9675799943ab8b8d081e8d1796d31c29c[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 23 13:50:50 2018 +0530

    ops: little bug fixes

[33mcommit ac29786f378d7b0a71f4d37e6a63363624543888[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 23 12:00:53 2018 +0530

    wallet: update env vars

[33mcommit 2243c6098adecc1f18999f7b3fc4f2f899603814[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 23 11:53:31 2018 +0530

    hub: upgrade dev entry script to fetch eth env vars from artifacts/mnemonic

[33mcommit 0a0f68e49fa26917f4a8b9106c1ed6157bc9701c[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 23 11:51:47 2018 +0530

    makefile: little bug fixes

[33mcommit 3261dbc48cfbcad167e4180bf6b581151ebe8749[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 23 11:40:05 2018 +0530

    contracts: expose migration-finished flag port

[33mcommit 195b025c80754f38facabfd4bfbc357b160393ee[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 23 09:30:24 2018 +0530

    client: import shiv's changes

[33mcommit b4739c01defb51b1c51a9be1898c3f52e349cb9d[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 23 08:43:00 2018 +0530

    wallet: clean up entrypoint

[33mcommit 0b78c1c1ef820a962dd71f9b96c24b50d70c048a[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 23 08:42:39 2018 +0530

    hub: consolidate entrypoint scripts

[33mcommit d91982993d00225c10b6ae71bf4c26f8839af2b3[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 23 08:36:51 2018 +0530

    database: clean up dockerfile

[33mcommit 4468d9c39fc8a375d34afe873f073e05b77c2f92[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 23 08:36:10 2018 +0530

    contracts: cut ethprovider build time to 1/25th

[33mcommit 7612d5865db370620aa748000a8654d0121ac677[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 23 08:34:24 2018 +0530

    makefile: fix logging

[33mcommit 33e294bf46640f759457d52845ceef61471ec148[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sat Dec 22 23:19:24 2018 +0530

    wallet: clean up entry script

[33mcommit 314a5e2680794d8f0baa9c70c88c097ef327aade[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sat Dec 22 23:19:06 2018 +0530

    makefile: cleanup

[33mcommit 4b53b46f699863017e3d83ec73063809a9e0044e[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sat Dec 22 22:53:17 2018 +0530

    clean up env vars

[33mcommit 25a080b1a847cfc38cf9480f14158f7d6dc7950b[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sat Dec 22 22:30:05 2018 +0530

    wallet: add headers needed for auth

[33mcommit af6531c3d864e4c8abc91f37ccd0ce53713bcf53[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sat Dec 22 22:25:22 2018 +0530

    wallet: rm connext-client & use modules/client instead

[33mcommit f3089c287622f8f69326e06f279398a72b984fb7[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sat Dec 22 22:24:45 2018 +0530

    slow down wallet sync

[33mcommit f0a5e183322d331fc957dc4ac33db15b59fb269b[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sat Dec 22 22:24:36 2018 +0530

    client: add watch script

[33mcommit 1b7f60b03e2b8cd10610158781f696da2a8b41a7[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sat Dec 22 20:40:16 2018 +0530

    hub: verbosify request/response logs

[33mcommit e1f948261451837b7f3a5f79b0c81f88db9791e8[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sat Dec 22 20:38:29 2018 +0530

    init proxy

[33mcommit e661ed2933cfd456fd00947f754038fcaec5d315[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sat Dec 22 18:35:39 2018 +0530

    init modules/wallet (aka payment-starter-kit)

[33mcommit 04eed25df647adf9b7d8c0befedbd1e7cfb1e364[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Fri Dec 21 17:28:01 2018 +0530

    import changes from payment-starter-kit

[33mcommit 245850d6970d96f94420bbb4e5c9e083b00d5502[m
Merge: 4761cf9 9618861
Author: Bo Henderson <bohende@gmail.com>
Date:   Fri Dec 21 16:17:25 2018 +0530

    Merge branch 'upgrade-chainsaw-signer'

[33mcommit 961886184064633f03e57ef1ecd1e28c2b353ad9[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Fri Dec 21 15:49:17 2018 +0530

    hub: update chainsaw service to sign with local priv key

[33mcommit df1f367588ce9b6759cafc3ecd47279a66fd2ece[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Fri Dec 21 15:04:31 2018 +0530

    ops/stop: fix race condition

[33mcommit cfc012f5bb02463f0277e4792442c1e9bc3cbd55[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Fri Dec 21 14:45:20 2018 +0530

    makefile: upgrade logging

[33mcommit 0586b65cc3a24e7c68616fb990c290378e1d04fd[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Fri Dec 21 14:18:51 2018 +0530

    hub: sync w camsite commit 2521f353

[33mcommit 01088c79191aaf8e3baf5f7c49f4692d6b291793[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Fri Dec 21 14:16:47 2018 +0530

    client: sync w camsite commit 2521f353

[33mcommit 4761cf9ce105b373c74fd6b3f128068e67ed10a8[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Thu Dec 20 09:48:14 2018 -0800

    Remove e2e

[33mcommit cb8288d114ec7fc05c310c3c41a7559611524240[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Dec 20 20:27:17 2018 +0530

    ops: fix linker scripts

[33mcommit f8ca8b2d071fee8e4bd1953d41f676f9625607f2[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Dec 20 20:04:17 2018 +0530

    migrate back to import foo = require(bar) syntax

[33mcommit a94aca313158a03d620c6fa797ad5c0e8c66fd23[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Dec 20 17:02:43 2018 +0530

    hub: install connext-client module from github

[33mcommit 7514affb8fa322b0bf388ee2bc74ecebfadaa0c8[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Dec 20 16:55:54 2018 +0530

    client: sync w camsite/client commit 59dfc439

[33mcommit 9d6a700cf256e3f301737f78f8a802a7e95bc4a6[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Dec 20 16:27:15 2018 +0530

    fix misc run-time bugs

[33mcommit 7cbfd9f3e7b560736ed0ee8145c566950b6ee750[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Dec 20 11:53:03 2018 +0530

    database: sync w camsite/hub/src/sql commit 59dfc439

[33mcommit 242aeeae6a6bf643a7a5c6ce0558975084fc9860[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Dec 20 11:52:43 2018 +0530

    hub: sync with camsite commit 59dfc439

[33mcommit ff077c63a9c3d2acb1a54a6708cc4a768573ad00[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Dec 20 10:45:15 2018 +0530

    update readme to make deployment instructions more clear

[33mcommit 3c14f2cb8527308c3dafdd7029b33364fcdd64d3[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Wed Dec 19 08:50:06 2018 +0530

    makefile: little bug fix

[33mcommit 04c31efad32aaab2cf96d14b9334eb7382193f3a[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Wed Dec 19 08:42:50 2018 +0530

    Manage secret file paths via env vars

[33mcommit e0d9df041a9ea059dd3cdd8a60319c76e7841ada[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Wed Dec 19 08:27:35 2018 +0530

    contracts: split migrations & update README w contract deployment instructions

[33mcommit 439f3e11497b4c79783ce5df312ace901ce953f2[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Tue Dec 18 20:44:17 2018 +0530

    hub: cleanup tsconfig

[33mcommit 203bc516c7558a63729c6cff792205883707249a[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Tue Dec 18 20:44:03 2018 +0530

    hub: remove connext from dependencies

[33mcommit daeb482f8c32e28d0810ef1c1d13241471de5f0e[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Tue Dec 18 20:42:15 2018 +0530

    client: add main file to package.json

[33mcommit 962bffcc24b7b1df3680906bd4299f3c1469b9b1[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Tue Dec 18 19:32:28 2018 +0530

    hub: configure dev-mode deployment

[33mcommit e3b5803cdcc22388b3fd50ec779bbfc3a7d4707c[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Tue Dec 18 19:16:55 2018 +0530

    hub: undo my previous fix that actually made things worse

[33mcommit c5bc09bc5be0b40b344c4aca9974d23832994ef3[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Tue Dec 18 19:02:11 2018 +0530

    hub: init dev-mode build

[33mcommit d25955e4029ba5d02bc02650fa099a1368d56a13[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Tue Dec 18 18:30:21 2018 +0530

    hub: rename ts entrypoint

[33mcommit 878dd5ad5b3b3bb6f6d11d57c0ea39f7688cbd20[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Tue Dec 18 18:24:55 2018 +0530

    client: get test working again

[33mcommit 58d2aca69944ba6104023ecb0f02f31d3c04b682[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Tue Dec 18 17:44:41 2018 +0530

    client: init make client command

[33mcommit 88a1029fded35c7a6f243d1e745ec4a49ab3c01e[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Tue Dec 18 17:41:27 2018 +0530

    rm -rf hub/src/sql

[33mcommit c2f77c8975ac6635819cbe8f955e02cfdcb6750b[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Tue Dec 18 17:13:51 2018 +0530

    import client code from camsite/client

[33mcommit 54b730d141468bc024ff3be2de36fea04fa3c7cf[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Tue Dec 18 14:53:23 2018 +0530

    client: clean up happy case test

[33mcommit 78bd56fa0937dee02e098a57c3e2ecb626bd1591[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Tue Dec 18 14:52:08 2018 +0530

    hub: have it give the client the entire state

[33mcommit d06c68a7882c8b89409d59cd82d97495b4c43f68[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Tue Dec 18 14:20:41 2018 +0530

    CRAuthManager: ignore case while checking sigs

[33mcommit d03af94fb2f9b8d4f2db47cb409094e3c6e02613[m
Merge: 7095dd9 c19b433
Author: Bo Henderson <bohende@gmail.com>
Date:   Tue Dec 18 14:22:53 2018 +0530

    Merge branch 'devops-refactor'

[33mcommit c19b433a4f87ffa8e44203c095bd8b796eb716a7[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Tue Dec 18 14:02:48 2018 +0530

    rm e2e module & merge thatscript into the client tests

[33mcommit 7f2cce3c0c0ae8b86642cbcc1285b4e884dc7e3c[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Tue Dec 18 13:58:02 2018 +0530

    reorganize client docs

[33mcommit f87c594918e0236d15d1d51180257ec338d6e614[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Tue Dec 18 13:50:31 2018 +0530

    re-init connext-client module

[33mcommit 986482c0bca3b308036eb54fa8f59e61158c2cc1[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Tue Dec 18 09:48:19 2018 +0530

    hub/src: sync w camsite commit cfcc5203

[33mcommit 15308e8152690decb6ba1469b76fb04c69d2092c[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Mon Dec 17 16:36:26 2018 +0530

    makefile: squash small bugs

[33mcommit ba6642d13080f2a9a46ece68ef978d5939ad5499[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 16 14:47:03 2018 +0530

    hub: make unit tests self-contained

[33mcommit 25e71956fbb9d33a14297b17b4cb522eabac8a4c[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 16 14:18:33 2018 +0530

    ops: rename builder image to be project-specific

[33mcommit 500eb867de82ebd6af0e1d8c40ef998f02f9aed4[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sun Dec 16 14:17:26 2018 +0530

    makefile: add logs to split output into sensible chunks

[33mcommit 7095dd95a6e18cfb5f37db1c87ce17f56fdfb20e[m
Author: Rahul <rksethuram9@gmail.com>
Date:   Fri Dec 14 12:58:55 2018 -0800

    Add network timeout

[33mcommit 4ea39b223ab08c725d3b2e73d274818f90c4f61f[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sat Dec 15 00:03:08 2018 +0530

    ops: little misc tweaks

[33mcommit 13c23cd49def370001c1e8beda04db6c408e88ae[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Sat Dec 15 00:02:45 2018 +0530

    contracts: fix bug in helper script

[33mcommit 20c3528f704f58a449222ae27eb5f31359a7d4d1[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Fri Dec 14 17:26:31 2018 +0530

    ops: make it simpler to test prod deployment locally

[33mcommit 1a4dfa24941042466bdd94e13bab38e692737cd6[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Fri Dec 14 17:21:51 2018 +0530

    hub: overhaul & consolidate entrypoint scripts

[33mcommit f9ac58a3325e6023081ff0aa13359ae3de82eb97[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Fri Dec 14 16:27:25 2018 +0530

    database: signal the completion of migrations on port 5433

[33mcommit de00e426a35ae33667292e5335e2747cb1cba391[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Fri Dec 14 16:26:57 2018 +0530

    makefile: add phony rule to run unit tests

[33mcommit e9098883028b3c68e9b3bfbd9eff6e414fa12d2e[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Fri Dec 14 13:08:18 2018 +0530

    hub: separate hub from chainsaw in dev-mode deployment

[33mcommit 694a920aa01559eb07c6c68864ccc70a18207171[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Fri Dec 14 13:07:54 2018 +0530

    contracts: make ethprovider generate a new block every 3 seconds

[33mcommit 6aa48b51147955b17013dcd108f2314bc243b6dc[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Fri Dec 14 13:02:23 2018 +0530

    rm -rf client module

[33mcommit 66a7b3a23856284626377de385904456399b4403[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Dec 13 18:03:24 2018 +0530

    hub: setup unit-test env vars

[33mcommit 18b78b09b1f404b4a853936628f0ef302377054b[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Dec 13 16:09:40 2018 +0530

    move hub unit tests from project root to hub module

[33mcommit 8e34e2068c00c82da51ecb8b8a14d37169858446[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Dec 13 16:03:07 2018 +0530

    ops: make network attachable in dev-mode

[33mcommit 23e4bcb02c354a5b77e101ac3eed2feb2312e421[m
Merge: ade2868 dc080ae
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Dec 13 15:02:28 2018 +0530

    Merge branch 'sync-w-camsite'

[33mcommit dc080ae52e3606d0954c956a166697ae078e35da[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Dec 13 14:50:33 2018 +0530

    hub/src: rm obsolete files

[33mcommit af1ec5db02b9a5d9974608a1dddd3482ac50c8da[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Dec 13 14:40:07 2018 +0530

    hub/src: sync with camsite commit 279c2a53

[33mcommit c6de4eb3ee8876cb8e9969d0a745a9d8881d3758[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Dec 13 14:36:33 2018 +0530

    hub/src: sync w camsite commit e4c30899

[33mcommit 5eef7f0c018a9d35789e34e9a2d52eb04637d6c0[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Dec 13 14:31:25 2018 +0530

    hub/src: sync w camsite

[33mcommit f9825ead38879034ca88b36ba6a42d7222a8a92f[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Dec 13 14:24:58 2018 +0530

    hub: sync package.json w that from camsite

[33mcommit b3562869c617c0049d17dc81bbf0a5704ed9519d[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Dec 13 14:18:10 2018 +0530

    ops: init script for importing git history from camsite

[33mcommit ade28680e5b0356a1bc8549c137ff45ed7b1d532[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Thu Dec 13 14:14:09 2018 +0530

    e2e: clean up endpoint tests so that userAuthorizedUpdate works

[33mcommit 9ef69d79d93598fc9231a32a657b09af866585d9[m
Author: shivani <gupta.shivani254@gmail.com>
Date:   Tue Dec 11 17:31:51 2018 +0530

    e2e: add call to channel manager

[33mcommit e360c56cfe568c1476ab90e26773af004e3c7b72[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Tue Dec 11 15:18:41 2018 +0530

    makefile: init client installation & transpilation

[33mcommit a9a6c096a5c09b97affaeb2fe7d8de5c7bf8ca66[m
Author: shivani <gupta.shivani254@gmail.com>
Date:   Tue Dec 11 15:05:35 2018 +0530

    client: import client from camsite

[33mcommit ebfc55ddfc0c30e62c86a68c1c66936c56aaefb6[m
Author: shivani <gupta.shivani254@gmail.com>
Date:   Mon Dec 10 20:39:44 2018 +0530

    update readme and init endpoint test script

[33mcommit 7f47a8cc590219412ca701c1fddbb3397e5badfa[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Tue Dec 11 12:38:58 2018 +0530

    hub/ops: fix bug while waiting for redis

[33mcommit 8509e0c74c053bd24df8e18e4a76d8e19028977e[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Tue Dec 11 12:28:54 2018 +0530

    hub: upgrade entrypoint logs

[33mcommit 754f82f26a7a82ca0bd1d457d7b417d56905fdb9[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Mon Dec 10 21:17:39 2018 +0530

    hub: rm chainsaw image & consolidate build steps

[33mcommit 1ca2e75cf7bd3633c5dacca077d37a52de32af7b[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Mon Dec 10 20:09:42 2018 +0530

    hopefully fix last bug

[33mcommit e0506ab723f37542d8195cc88d00af2f596f204a[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Mon Dec 10 19:54:10 2018 +0530

    misc bug fixes

[33mcommit e0f83db54a87724d0d7482a5d1d9b4526d0518c9[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Mon Dec 10 19:40:16 2018 +0530

    ops: misc cleanup

[33mcommit f2ecff197864b3a24616fc3a4e9b5297cfd0beeb[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Mon Dec 10 19:02:47 2018 +0530

    hub: little bugfix in ethers import

[33mcommit 0691e2ffcf02d12e4ba6a47d3db51125330c56a1[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Mon Dec 10 18:53:14 2018 +0530

    ops: make prod-mode deploy easier to do locally

[33mcommit 3ff402351d2b86f052039f042300649b020cfca8[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Mon Dec 10 18:52:54 2018 +0530

    ops: add private key secret in dev mode too

[33mcommit db549f92490e6abfe09736ee86afc123851c8dab[m
Author: Bo Henderson <bohende@gmail.com>
Date:   Mon Dec 10 18:51:33 2018 +0530

    makefile: add installation for e2e stuff
